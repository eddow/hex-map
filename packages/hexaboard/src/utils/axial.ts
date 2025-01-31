/**
 * @link https://www.redblobgames.com/grids/hexagons/
 */
import type { Vector2Like } from 'three'
import type { Sextuplet } from '~/types'
import type { RandGenerator } from '~/utils/numbers'
import { assert } from './debug'

// TODO: Type "all-refs" with q,r,key

export type AxialKey = number
export interface AxialCoord {
	q: number
	r: number
}
export interface Axial extends AxialCoord {
	key: AxialKey
}
export type AxialRef = AxialKey | AxialCoord | Axial

/**
 * Position in a triangle: side of the triangle and [u,v] where u+v<=1
 */
export interface Triangular {
	/**
	 * Side: [0..6[
	 */
	s: number
	u: number
	v: number
}

/**
 * null = on center
 * 0-5 = on edge
 */
export type AxialDirection = null | 0 | 1 | 2 | 3 | 4 | 5

export function cube({ q, r }: AxialCoord) {
	return { q, r, s: -q - r }
}

export type Rotation = (c: AxialCoord) => AxialCoord

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

/**
 * @todo: arg -> Axial
 */
export function cartesian(aRef: AxialRef, size = 1) {
	const { q, r } = axial.coord(aRef)
	const A = Math.sqrt(3) * size
	const B = (Math.sqrt(3) / 2) * size
	const C = (3 / 2) * size

	return { x: A * q + B * r, y: C * r }
}

export function fromCartesian({ x, y }: Vector2Like, size: number) {
	const A = Math.sqrt(3) * size
	const B = (Math.sqrt(3) / 2) * size
	const C = (3 / 2) * size

	const r = y / C
	const q = (x - B * r) / A
	return { q, r }
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t
}

/**
 * Generate uniformly a valid {s,u,v} position in a tile
 * @returns {s,u,v}
 */
export function genTilePosition(gen: RandGenerator, radius = 1) {
	let [u, v] = [gen(radius), gen(radius)]
	const s = Math.floor(gen(6))
	if (u + v > radius) [u, v] = [radius - u, radius - v]
	return { s, u, v }
}

/**
 * Get a {s,u,v} position in a tile
 * * s is the side index [0,6[
 * * u,v are the coordinates in the triangle for that side
 * @param aRef
 * @param radius Specified virtual "radius" of the tile (subdivisions of the tile this function works with)
 * @returns {s,u,v}
 */
export function posInTile(aRef: AxialRef, radius: number) {
	if (axial.zero(aRef)) return { s: 0, u: 0, v: 0 }
	const coord = axial.coord(aRef)
	const outerRadius = radius + 0.5
	const { q, r } = { q: coord.q / outerRadius, r: coord.r / outerRadius }
	const s = -q - r
	const signs = (q >= 0 ? 'Q' : 'q') + (r >= 0 ? 'R' : 'r') + (s >= 0 ? 'S' : 's')
	return {
		Qrs: { s: 0, u: -r, v: -s },
		QrS: { s: 1, u: s, v: q },
		qrS: { s: 2, u: -q, v: -r },
		qRS: { s: 3, u: r, v: s },
		qRs: { s: 4, u: -s, v: -q },
		QRs: { s: 5, u: q, v: r },
	}[signs]!
}
function bitShiftPair({ q, r }: AxialCoord): number {
	return (q << 16) | (r & 0xffff) // Ensure b fits in 16 bits for comparison
}

function bitShiftUnpair(z: number): AxialCoord {
	const rv = { q: z >> 16, r: z & 0xffff }
	if (rv.r > 32767) rv.r -= 65536
	return rv
}

export const axial = {
	access(aRef: AxialRef): Axial {
		if (typeof aRef === 'number') return axial.keyAccess(aRef)
		return axial.coordAccess(aRef)
	},
	keyAccess(aRef: AxialKey): Axial {
		return {
			key: aRef,
			...bitShiftUnpair(aRef),
		}
	},
	coordAccess(aRef: AxialCoord): Axial {
		if ('key' in aRef) return aRef as Axial
		return {
			...aRef,
			key: bitShiftPair(aRef),
		}
	},
	/**
	 * Get the axial-ref as an axial: an object `{q, r}`
	 * @returns AxialCoord
	 * @todo Remove all refs
	 * @deprecated use AxialAccess
	 */
	coord(aRef: AxialRef | string): AxialCoord {
		switch (typeof aRef) {
			case 'number':
				return bitShiftUnpair(aRef)
			case 'string': {
				const [q, r] = aRef.split(',').map(Number)
				return { q, r }
			}
			default:
				return aRef
		}
	},
	/**
	 * Get the axial-ref as a key
	 * @returns string
	 * @todo Remove all refs
	 * @deprecated use AxialAccess
	 */
	key(aRef: AxialRef | string): AxialKey {
		switch (typeof aRef) {
			case 'number':
				return aRef
			case 'string':
				return bitShiftPair(axial.coord(aRef))
			default:
				return (aRef as Axial).key ?? bitShiftPair(aRef)
		}
	},

	toString(aRef: AxialRef) {
		const { q, r } = axial.coord(aRef)
		return `<${q} ${r}>`
	},

	/**
	 * Addition a list of axial coordinates optionally with a scalar coefficient
	 * @param args [coef, AxialRef] Scalar coefficient and axial to multiply/add
	 * @param args AxialRef Axial to add
	 * @returns AxialCoord
	 */
	linear(...args: ([number, AxialRef] | AxialRef)[]): AxialCoord {
		return args.reduce<AxialCoord>(
			(acc, term) => {
				const [coef, aRef] = Array.isArray(term) ? term : [1, term]
				const { q, r } = axial.coord(aRef)
				return { q: acc.q + coef * q, r: acc.r + coef * r }
			},
			{ q: 0, r: 0 }
		)
	},
	/**
	 * Retrieves if the axial is at 0,0
	 * @returns boolean
	 */
	zero(aRef: AxialRef) {
		if (typeof aRef !== 'object') return aRef === 0
		const { q, r } = axial.coord(aRef)
		return q === 0 && r === 0
	},

	lerp(a: AxialCoord, b: AxialCoord, t: number) {
		// epsilon to avoid straight mid-points (point exactly on the line between 2 hexagons)
		return { q: lerp(a.q + 1e-6, b.q + 2e-6, t), r: lerp(a.r, b.r, t) }
	},

	round({ q, r }: AxialCoord) {
		const v = [q, r, -q - r]
		const round = v.map(Math.round)
		const diff = v.map((v, i) => Math.abs(round[i] - v))
		const [rq, rr, rs] = round

		return [
			{ q: -rr - rs, r: rr },
			{ q: rq, r: -rq - rs },
			{ q: rq, r: rr },
		][diff.indexOf(Math.max(...diff))]
	},

	distance(a: AxialCoord, b: AxialCoord = { q: 0, r: 0 }) {
		const aS = -a.q - a.r
		const bS = -b.q - b.r
		return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(aS - bS))
	},

	/**
	 * For 2 neighbors, returns the 2 orthogonal neighbors: the 2 points who are common neighbors
	 * @param ARef
	 * @param BRef
	 * @returns
	 */
	orthogonal(ARef: AxialRef, BRef: AxialRef): [AxialCoord, AxialCoord] {
		const sideAxial = axial.linear(ARef, [-1, BRef])
		const side = hexSides.findIndex(({ q, r }) => q === sideAxial.q && r === sideAxial.r)
		assert(side !== -1, 'Orthogonal: Points must be neighbors')
		return [
			axial.linear(BRef, hexSides[(side + 1) % 6]),
			axial.linear(BRef, hexSides[(side + 5) % 6]),
		]
	},
	*enum(maxAxialDistance: number) {
		for (let q = -maxAxialDistance; q <= maxAxialDistance; q++) {
			for (
				let r = Math.max(-maxAxialDistance, -q - maxAxialDistance);
				r <= Math.min(maxAxialDistance, -q + maxAxialDistance);
				r++
			)
				yield { q, r }
		}
	},

	/**
	 * Retrieves the tiles around a given tile
	 * @returns AxialCoord[]
	 */
	neighbors(aRef: AxialRef): Sextuplet<AxialCoord> {
		return hexSides.map((side) => axial.linear(aRef, side)) as Sextuplet<AxialCoord>
	},
	neighborIndex(coord: AxialCoord, from?: AxialCoord) {
		if (from) coord = axial.linear(coord, [-1, from])
		return neighborIndexes[coord.q * 3 + coord.r + 4]
	},
}
const neighborIndexes: (AxialDirection | undefined)[] = [
	undefined, // q-1 r-1
	3, // q-1 r 0
	2, // q-1 r+1
	4, // q 0 r-1
	undefined, // q 0 r 0
	1, // q 0 r+1
	5, // q+1 r-1
	0, // q+1 r 0
	undefined, // q+1 r+1
]

// @ts-expect-error - this is only for debug purpose anyway
if (typeof window !== 'undefined') window.axial = axial
