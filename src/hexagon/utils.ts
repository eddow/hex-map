export interface Axial {
	q: number
	r: number
}
const { floor, sqrt, max, abs } = Math

export function cube({ q, r }: Axial) {
	return { q, r, s: -q - r }
}

export function axialDistance(a: Axial, b: Axial = { q: 0, r: 0 }) {
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
export function axialPolynomial(...args: [number, Axial][]): Axial {
	return args.reduce(
		(acc, [coef, axial]) => ({ q: acc.q + coef * axial.q, r: acc.r + coef * axial.r }),
		{ q: 0, r: 0 }
	)
}

/** Returns the axial coordinates of the nth hexagonal tile */
export function axialAt(n: number): Axial {
	if (n === 0) return { q: 0, r: 0 }
	const radius = floor((3 + sqrt(-3 + 12 * n)) / 6)
	const previous = 3 * radius * (radius - 1) + 1
	const sidePos = n - previous
	const side = floor(sidePos / radius)
	return axialPolynomial([radius, hexSides[side]], [sidePos % radius, hexSides[(side + 2) % 6]])
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

export function axialIndex({ q, r }: Axial) {
	if (q === 0 && r === 0) return 0
	const s = -q - r
	const ring = max(abs(q), abs(r), abs(s))
	const side = [q === ring, r === -ring, s === ring, q === -ring, r === ring, s === -ring].indexOf(
		true
	)
	//const offset = [q, -s, r, -q, s, -r][side]
	const offset = [-r, s, -q, r, -s, q][side]
	return 3 * ring * (ring - 1) + side * ring + offset + 1
}

export function cartesian({ q, r }: Axial, size: number) {
	const A = Math.sqrt(3) * size
	const B = (Math.sqrt(3) / 2) * size
	const C = (3 / 2) * size

	return { x: A * q + B * r, y: C * r }
}
