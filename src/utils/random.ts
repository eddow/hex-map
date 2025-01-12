export type RandGenerator = (max?: number, min?: number) => number
export type RandFactory = (...seeds: number[]) => RandGenerator
const { abs } = Math
/**
 * Linear Congruential Generator
 */
const [a, c, m] = [1664525, 1013904223, 2 ** 32]
export default function LCG(...seeds: number[]): RandGenerator {
	let state = seeds.length
		? abs(seeds.reduce((acc, seed) => acc ^ (seed * m), 0))
		: Math.random() * m
	return (max = 1, min = 0) => {
		state = (a * state + c + m) % m
		return (state / m) * (max - min) + min
	}
}

export function trianglePoint(gen: RandGenerator) {
	const u = gen()
	const v = gen()
	return u + v > 1 ? [1 - u, 1 - v, u + v - 1] : [u, v, 1 - u - v]
}