function stringToHash(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		// Convert character to its ASCII code and add it to the hash
		hash = (hash << 5) - hash + str.charCodeAt(i)
		// Convert to 32bit integer
		hash |= 0
	}
	return hash * Math.PI
}

function numeric(seed: number | string): number {
	return typeof seed === 'string' ? stringToHash(seed) : seed * Math.PI
}

export type RandGenerator = (max?: number, min?: number) => number
/**
 * Linear Congruential Generator
 */
const [a, c, m] = [1664525, 1013904223, 2 ** 32]
export function LCG(...seeds: (number | string)[]): RandGenerator {
	let state = seeds.length
		? Math.abs(seeds.reduce<number>((acc, seed) => acc ^ (numeric(seed) * c), 0))
		: Math.random() * m
	return (max = 1, min = 0) => {
		state = (a * state + c + m) % m
		return (state / m) * (max - min) + min
	}
}

/**
 * Returns an array of numbers between min and maxP (without maxP)
 */
export function numbers(maxP: number, min = 0, step = 1) {
	const arr = []
	for (let i = min; i < maxP; i += step) arr.push(i)
	return arr
}

export function subSeed(...seeds: (number | string)[]) {
	return seeds.reduce<number>((acc, seed) => acc ^ (numeric(seed) * c), 0)
}
