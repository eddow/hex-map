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

export class LockSemaphore {
	logs: any[][] = []
	log(...args: any[]) {
		this.logs.unshift(args)
		if (this.logs.length > 100) this.logs.length = 100
	}
	private lockingTimeout?: ReturnType<typeof setTimeout>
	private callBacks?: ((locked: Element | null) => void)[]
	public locked: Element | null = null

	constructor(private mainCb?: (locked: Element | null) => void) {
		document.addEventListener('pointerlockchange', () => {
			if (this.locked === document.pointerLockElement) this.doCallBack()
			else this.lock(this.locked)
		})
	}
	private doCallBack() {
		this.log('doCallBack', !!document.pointerLockElement)
		if (this.callBacks) {
			if (this.mainCb) this.mainCb(document.pointerLockElement)
			for (const cb of this.callBacks!) cb(document.pointerLockElement)
			this.callBacks = undefined
		}
	}
	lock(element: Element | null) {
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

/**
 * Returns an array of numbers between min and maxP (without maxP)
 */
export function numbers(maxP: number, min = 0) {
	const arr = []
	for (let i = min; i < maxP; i++) arr.push(i)
	return arr
}
