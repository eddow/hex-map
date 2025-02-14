import { assert } from '../debug'

const coreCount = navigator.hardwareConcurrency || 4
const isMobile = /Mobi|Android/i.test(navigator.userAgent)

// Mobile: Use fewer workers (e.g., 50% of cores, minimum 2).
// Desktop: Use more workers (e.g., 75% of cores, minimum 4).
const maximumWorkers = isMobile
	? Math.max(2, Math.floor(coreCount * 0.5))
	: Math.max(4, Math.floor(coreCount * 0.75))
let activeWorkers = 0
const workerQueue: (() => void)[] = []
const idleLifeTime = [100, 3000]

/**
 * Allocates a worker slot. Returns a promise that resolves when a slot is free.
 */
function allocateWorkerSlot(): Promise<void> {
	return new Promise<void>((resolve) => {
		const executeTask = () => {
			activeWorkers++
			resolve()
		}

		if (activeWorkers < maximumWorkers) {
			executeTask()
		} else {
			workerQueue.push(executeTask)
		}
	})
}

/**
 * Frees a worker slot, allowing queued tasks to start.
 */
function freeWorkerSlot(): void {
	activeWorkers--
	if (workerQueue.length > 0) {
		const nextTask = workerQueue.shift()!
		nextTask()
	}
}

type WorkerDefinition = { new (): Worker } | URL | string
function loadWorker(worker: WorkerDefinition) {
	if (typeof worker === 'function') return new worker()
	return new Worker(worker, { type: 'module' })
}

/**
 * Manages a pool of workers to run tasks concurrently. Each run allocates (perhaps instantiates) a worker, and runs a task once
 */
export class ThreadTask<Fct extends (...args: any[]) => Promise<any>> {
	private pendingRequests: Map<
		Worker,
		{ resolve: (result: ReturnType<Fct>) => void; reject: (error: any) => void }
	> = new Map()
	private idleTimeouts: Map<Worker, ReturnType<typeof setTimeout>> = new Map()

	constructor(private definition: WorkerDefinition) {}

	/**
	 * Runs a task in an available worker.
	 */
	async run(...compute: Parameters<Fct>): Promise<ReturnType<Fct>> {
		await allocateWorkerSlot()

		return new Promise((resolve, reject) => {
			const worker = this.getWorker()
			this.pendingRequests.set(worker, { resolve, reject })
			worker.postMessage({ compute })
		})
	}

	/**
	 * Gets an available worker or creates a new one if needed.
	 */
	private getWorker(): Worker {
		if (this.idleTimeouts.size) {
			const idling = this.idleTimeouts.entries().next().value!
			clearTimeout(idling[1])
			this.idleTimeouts.delete(idling[0])
			return idling[0]
		}
		const worker = loadWorker(this.definition)
		this.setupWorker(worker)
		return worker
	}

	/**
	 * Sets up message and error handling for a worker.
	 */
	private setupWorker(worker: Worker) {
		worker.onmessage = (event) => {
			const working = this.pendingRequests.get(worker)
			if (!working) return

			const { resolve } = working
			this.pendingRequests.delete(worker)
			freeWorkerSlot()
			this.recycleWorker(worker)
			resolve(event.data.result)
		}

		worker.onerror = (error) => {
			console.error('Worker error:', error)
			const working = this.pendingRequests.get(worker)
			if (working) {
				working.reject(new Error('Worker failed'))
				this.pendingRequests.delete(worker)
			}
			this.terminateWorker(worker)
		}
	}
	/**
	 * Moves an idle worker to the pool and sets a timeout for termination.
	 */
	private recycleWorker(worker: Worker) {
		if (this.pendingRequests.size < maximumWorkers) {
			this.idleTimeouts.set(
				worker,
				setTimeout(
					() => this.terminateWorker(worker),
					idleLifeTime[1] +
						(idleLifeTime[0] - idleLifeTime[1]) * (this.idleTimeouts.size / maximumWorkers)
				)
			)
		} else this.terminateWorker(worker)
	}

	/**
	 * Terminates an idle worker to free resources.
	 */
	private terminateWorker(worker: Worker) {
		const working = this.pendingRequests.get(worker)
		if (working) {
			working.reject(new Error('Worker terminated'))
			this.pendingRequests.delete(worker)
		}
		worker.terminate()
		this.idleTimeouts.delete(worker)
	}
}

export type WorkerExposition = Record<PropertyKey, (...args: any[]) => Promise<any>>
export type FunctionCall<Exposition extends WorkerExposition> = {
	fn: keyof Exposition
	args: Parameters<Exposition[keyof Exposition]>
	resolve?: (result: ReturnType<Exposition[keyof Exposition]>) => void
	reject?: (error: any) => void
}

/**
 * Allocates a worker AND a slot for the duration of several calls
 * Each task call will be sequential
 */
export class AllocatedWorker<Exposition extends WorkerExposition> {
	private disposed = false
	private slot?: Promise<void>
	private slotAllocations = 0
	private worker: Worker
	private runningTasks?: FunctionCall<Exposition>
	private queue: FunctionCall<Exposition>[] = []
	constructor(definition: WorkerDefinition) {
		this.worker = loadWorker(definition)
		this.slot = allocateWorkerSlot()
		this.worker.onmessage = ({ data }) => {
			if (data.error) this.runningTasks!.reject!(new Error(data.error))
			else this.runningTasks!.resolve!(data.result)
			this.runningTasks = undefined
			this.runQueue()
		}
		this.worker.onerror = (err) => {
			this.runningTasks!.reject!(err)
			this.runningTasks = undefined
			this.runQueue()
		}
	}
	get slotAllocated() {
		return !!this.slot
	}
	set slotAllocated(value: boolean) {
		if (value) this.slotAllocations++
		else this.slotAllocations--
		if (this.slotAllocations && !this.slot) this.slot = allocateWorkerSlot()
		else if (!this.slotAllocations && this.slot) {
			freeWorkerSlot()
			this.slot = undefined
		}
	}
	dispose() {
		assert(this.runningTasks, 'Worker disposed while tasks are running')
		if (this.disposed) return
		this.worker.terminate()
		this.slotAllocated = false
		this.disposed = true
	}
	addTask(call: FunctionCall<Exposition>) {
		this.queue.push(call)
		this.runQueue()
	}
	private async runQueue() {
		if (!this.runningTasks && this.queue.length > 0) {
			this.runningTasks = this.queue.shift()!
			await this.slot
			this.worker.postMessage(this.runningTasks)
		}
	}
	async run<Fct extends keyof Exposition>(fn: Fct, ...args: Parameters<Exposition[Fct]>) {
		if (!this.slot) throw new Error('No slot allocated')
		const functionCall = { fn, args } as FunctionCall<Exposition>
		const task = new Promise<ReturnType<Exposition[Fct]>>((resolve, reject) => {
			functionCall.resolve = resolve
			functionCall.reject = reject
		})
		this.addTask(functionCall)
		return task
	}
	get exposed() {
		return new Proxy(
			{},
			{
				get:
					(_, fn: keyof Exposition) =>
					(...args: Parameters<Exposition[typeof fn]>) =>
						this.run(fn, ...args),
			}
		)
	}
}

export type FunctionParts = { args: string; body: string }

export function extractFunctionParts(fn: (...args: any[]) => any) {
	if (typeof fn !== 'function') throw new TypeError('Expected a function')

	const fnStr = fn.toString().trim()
	let args: string
	let body: string

	if (fnStr.startsWith('function')) {
		// Regular function: "function name(arg1, arg2) { body }"
		;[, args, body] = fnStr.match(/^function\s*\w*\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/) || []
	} else if (fnStr.startsWith('(') || fnStr.includes('=>')) {
		// Arrow function: "(arg1, arg2) => body" or "arg => body"
		;[, args, body] = fnStr.match(/^\(?([^)=]*)\)?\s*=>\s*\{?([\s\S]*)\}?$/) || []
	} else {
		// Method shorthand: "name(arg1, arg2) { body }"
		;[, args, body] = fnStr.match(/^\s*\w+\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/) || []
	}

	if (!args || !body) throw new Error('Failed to extract function parts')

	return {
		args: args.trim(),
		body: body.trim(),
	}
}
