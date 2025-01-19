import type { GameView } from '~/game'

export type RandGenerator = (max?: number, min?: number) => number
/**
 * Linear Congruential Generator
 */
const [a, c, m] = [1664525, 1013904223, 2 ** 32]
export default function LCG(...seeds: number[]): RandGenerator {
	let state = seeds.length
		? Math.abs(seeds.reduce((acc, seed) => acc ^ (seed * m), 0))
		: Math.random() * m
	return (max = 1, min = 0) => {
		state = (a * state + c + m) % m
		return (state / m) * (max - min) + min
	}
}

/**
 * Returns an array of numbers between min and maxP (without maxP)
 */
export function numbers(maxP: number, min = 0) {
	const arr = []
	for (let i = min; i < maxP; i++) arr.push(i)
	return arr
}

export const debugGameViews: GameView[] = []

let lockedSemaphore:
	| {
			semaphore: LockSemaphore
			element: Element | null
	  }
	| undefined

let semaphoreInitialized = false
const semaphoreLogs: any[][] = []
export class LockSemaphore {
	static init() {
		if (semaphoreInitialized) return
		semaphoreInitialized = true
		document.addEventListener('pointerlockchange', () => {
			const x = debugGameViews
			if (lockedSemaphore) {
				if (lockedSemaphore.element === document.pointerLockElement) {
					lockedSemaphore.semaphore.doCallBack()
					if (!document.pointerLockElement) lockedSemaphore = undefined
				} else lockedSemaphore.semaphore.lock(lockedSemaphore.element)
			}
		})
	}
	log(...args: any[]) {
		const log = [this.uuid, ...args]
		semaphoreLogs.unshift(log)
		if (semaphoreLogs.length > 100) semaphoreLogs.length = 100
	}
	private lockingTimeout?: ReturnType<typeof setTimeout>
	private callBacks?: ((locked: Element | null) => void)[]
	get locked(): Element | null {
		return (lockedSemaphore?.semaphore === this && lockedSemaphore?.element) || null
	}
	set locked(element: Element | null) {
		if (lockedSemaphore?.element && lockedSemaphore.semaphore !== this)
			throw new Error('LockSemaphore conflict: already locking')
		lockedSemaphore = { semaphore: this, element }
	}

	uuid = Math.random().toString(36).slice(2)
	constructor(private mainCb?: (locked: Element | null) => void) {}
	private doCallBack() {
		this.log('doCallBack', !!document.pointerLockElement)
		if (this.callBacks) {
			if (this.mainCb) this.mainCb(document.pointerLockElement)
			for (const cb of this.callBacks!) cb(document.pointerLockElement)
			this.callBacks = undefined
		}
	}
	lock(element: Element | null) {
		const x = debugGameViews
		if (this.lockingTimeout) clearTimeout(this.lockingTimeout)
		this.locked = element
		this.log('lock', !!element, !!document.pointerLockElement)
		if (this.locked !== document.pointerLockElement) {
			this.callWhenLocked(() => {
				this.log('act-lock', !!element, !!document.pointerLockElement)
				this.callBacks = []
				this.lockingTimeout = setTimeout(() => {
					if (element) element.requestPointerLock()
					else document.exitPointerLock()
					this.lockingTimeout = undefined
				})
			})
		} else this.doCallBack()
	}
	callWhenLocked(cb: (e: Element | null) => void) {
		if (this.callBacks) this.callBacks.push(cb)
		else cb(this.locked)
	}
}
LockSemaphore.init()
