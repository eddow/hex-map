export class WorkerPool {
	private workers: Worker[] = []
	private workerQueue: Worker[] = []
	private taskQueue: {
		data: any
		resolve: (result: any) => void
		transfer: Transferable[]
	}[] = []

	private workerTasks = new WeakMap<Worker, { resolve: (result: any) => void }>()
	private workerCount: number

	constructor(
		workerScript: URL,
		options: { maxWorkers?: number | 'auto'; mobileLimit?: number } = {}
	) {
		const coreCount = navigator.hardwareConcurrency || 4

		// Auto-detect: Reduce workers for mobile
		this.workerCount =
			options.maxWorkers === 'auto'
				? coreCount > 4
					? coreCount - 2
					: (options.mobileLimit ?? 2)
				: Math.min(coreCount, options.maxWorkers ?? coreCount)

		// Create workers
		for (let i = 0; i < this.workerCount; i++) {
			const worker = new Worker(workerScript, { type: 'module' })
			worker.onmessage = (e) => this._handleWorkerResponse(worker, e)
			this.workers.push(worker)
			this.workerQueue.push(worker)
		}
	}

	private _handleWorkerResponse(worker: Worker, event: MessageEvent) {
		const task = this.workerTasks.get(worker)
		if (task) {
			task.resolve(event.data)
			this.workerTasks.delete(worker)
		}

		// Assign next task or mark worker as available
		if (this.taskQueue.length > 0) {
			const nextTask = this.taskQueue.shift()!
			this._assignTask(worker, nextTask)
		} else {
			this.workerQueue.push(worker)
		}
	}

	private _assignTask(
		worker: Worker,
		task: { data: any; resolve: (result: any) => void; transfer: Transferable[] }
	) {
		this.workerTasks.set(worker, { resolve: task.resolve })
		worker.postMessage(task.data, task.transfer)
	}

	runTask<T>(data: any, transfer: Transferable[] = []): Promise<T> {
		return new Promise<T>((resolve) => {
			const task = { data, resolve, transfer }

			if (this.workerQueue.length > 0) {
				const worker = this.workerQueue.shift()!
				this._assignTask(worker, task)
			} else {
				this.taskQueue.push(task)
			}
		})
	}

	terminate(): void {
		for (const worker of this.workerQueue) worker.terminate()
		this.workers = []
		this.workerQueue = []
		this.workerTasks = new WeakMap()
	}
}
