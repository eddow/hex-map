import { Vector2, type Vector2Like } from 'three'
import { type RandGenerator, numbers } from './numbers'

function getConstantVector(v: number): Vector2 {
	return new Vector2(v & 1 ? -1 : 1, v & 2 ? -1 : 1)
}

function fade(t: number): number {
	return ((6 * t - 15) * t + 10) * t * t * t
}

function lerp(t: number, a1: number, a2: number): number {
	return a1 + t * (a2 - a1)
}
export class Perlin {
	readonly permutation: number[]
	constructor(gen: RandGenerator) {
		const perm1 = numbers(256)
		for (let e = perm1.length - 1; e > 0; e--) {
			const index = Math.floor(gen(e))
			;[perm1[index], perm1[e]] = [perm1[e], perm1[index]]
		}
		this.permutation = [...perm1, ...numbers(256)]
	}

	noise2D({ x, y }: Vector2Like): number {
		const X = Math.floor(x) & 255
		const Y = Math.floor(y) & 255

		const xf = x - Math.floor(x)
		const yf = y - Math.floor(y)

		const topRight = new Vector2(xf - 1.0, yf - 1.0)
		const topLeft = new Vector2(xf, yf - 1.0)
		const bottomRight = new Vector2(xf - 1.0, yf)
		const bottomLeft = new Vector2(xf, yf)

		const permutation = this.permutation
		const valueTopRight = permutation[permutation[X + 1] + Y + 1]
		const valueTopLeft = permutation[permutation[X] + Y + 1]
		const valueBottomRight = permutation[permutation[X + 1] + Y]
		const valueBottomLeft = permutation[permutation[X] + Y]

		const dotTopRight = topRight.dot(getConstantVector(valueTopRight))
		const dotTopLeft = topLeft.dot(getConstantVector(valueTopLeft))
		const dotBottomRight = bottomRight.dot(getConstantVector(valueBottomRight))
		const dotBottomLeft = bottomLeft.dot(getConstantVector(valueBottomLeft))

		const u = fade(xf)
		const v = fade(yf)

		return lerp(u, lerp(v, dotBottomLeft, dotTopLeft), lerp(v, dotBottomRight, dotTopRight))
	}

	heightMap({ x, y }: Vector2Like, max = 1, min = 0): number {
		let n = 0.0
		let a = 1.0
		let f = 0.05
		for (let o = 0; o < 8; o++) {
			const v = a * this.noise2D({ x: x * f, y: y * f })
			n += v

			a *= 0.5
			f *= 2.0
		}
		return ((n + 1) / 2) * (max - min) + min
	}
}
