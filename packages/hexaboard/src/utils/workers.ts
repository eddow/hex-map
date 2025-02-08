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

export class WorkerManager<Args extends any[], Returns> {
	private pendingRequests: Map<
		Worker,
		{ resolve: (result: Returns) => void; reject: (error: any) => void }
	> = new Map()
	private idleTimeouts: Map<Worker, NodeJS.Timeout> = new Map()

	constructor(private workerScript: URL) {}

	/**
	 * Runs a task in an available worker.
	 */
	async run(...data: Args): Promise<Returns> {
		await allocateWorkerSlot()

		return new Promise<Returns>((resolve, reject) => {
			const worker = this.getWorker()
			this.pendingRequests.set(worker, { resolve, reject })
			worker.postMessage(data)
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
		const worker = new Worker(this.workerScript, { type: 'module' })
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
			resolve(event.data)
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

export function expose<Args extends any[], Returns>(
	fn: (data: Args) => Promise<Returns> | Returns
) {
	self.onmessage = async (event: MessageEvent<Args>) => {
		try {
			postMessage({ result: await fn.apply(self, event) })
		} catch (err: any) {
			postMessage({ error: err.message, stack: err.stack })
		}
	}
}
