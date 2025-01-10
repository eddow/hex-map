const { floor, sqrt, max, abs } = Math

export interface Hex {
	x: number
	y: number
}

export interface Axial {
	q: number
	r: number
}

export function cube({ q, r }: Axial) {
	return { q, r, s: -q - r }
}

export function distance(a: Axial, b: Axial) {
	const aS = -a.q - a.r
	const bS = -b.q - b.r
	return max(abs(a.q - b.q), abs(a.r - b.r), abs(aS - bS))
}

export type Rotation = (c: Axial) => Axial

/** Rotations for 0, 60, 120, 180, 240 and 300° */
export const rotations: Rotation[] = [
	({ q, r }) => ({ q, r }),
	({ q, r }) => ({ q: q + r, r: -q }),
	({ q, r }) => ({ q: r, r: -q - r }),
	({ q, r }) => ({ q: -q, r: -r }),
	({ q, r }) => ({ q: -q - r, r: q }),
	({ q, r }) => ({ q: -r, r: q + r }),
]

export const hexSides = rotations.map((c) => c({ q: 1, r: 0 }))

/**
 * Sum of coef*axial
 * @param args [coef, axial]
 * @returns Axial
 */
export function polynomial(...args: [number, Axial][]): Axial {
	return args.reduce(
		(acc, [coef, axial]) => ({ q: acc.q + coef * axial.q, r: acc.r + coef * axial.r }),
		{ q: 0, r: 0 }
	)
}

/** Returns the axial coordinates of the nth hexagonal tile */
export function hexAt(n: number): Axial {
	if (n === 0) return { q: 0, r: 0 }
	const radius = floor((3 + sqrt(-3 + 12 * n)) / 6)
	const previous = 3 * radius * (radius - 1) + 1
	const sidePos = n - previous
	const side = floor(sidePos / radius)
	return polynomial([radius, hexSides[side]], [sidePos % radius, hexSides[(side + 2) % 6]])
}

/**
 * Retrieve the number of hexagon tiles in a complete hexagonal board of size radius
 */
export function hexTiles(radius: number) {
	return radius === 0 ? 0 : 3 * radius * (radius - 1) + 1
}

/**
 * Retrieve the number of hexagon tiles in an incomplete hexagonal board of size radius
 */
export function puzzleTiles(radius: number) {
	return 3 * radius ** 2
}

export const axial: Axial[] = []
export const indexes: Record<number, Record<number, number>> = {}

export function computeAxial(until: number) {
	while (axial.length < until) {
		const n = axial.length
		const h = hexAt(n)
		axial.push(h)
		if (!(h.q in indexes)) indexes[h.q] = {}
		indexes[h.q][h.r] = n
	}
}

export function axialIndex({ q, r }: Axial): number {
	return indexes[q][r]
}

export function cartesian({ q, r }: Axial, size: number) {
	const A = Math.sqrt(3) * size
	const B = (Math.sqrt(3) / 2) * size
	const C = (3 / 2) * size

	return { x: A * q + B * r, y: C * r }
}
