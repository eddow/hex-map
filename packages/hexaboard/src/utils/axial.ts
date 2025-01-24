/**
 * @link https://www.redblobgames.com/grids/hexagons/
 */
import type { Vector2Like } from 'three'
import type { RandGenerator } from '~/utils/numbers'

export interface Axial {
	q: number
	r: number
}

export function cube({ q, r }: Axial) {
	return { q, r, s: -q - r }
}

export function axialDistance(a: Axial, b: Axial = { q: 0, r: 0 }) {
	const aS = -a.q - a.r
	const bS = -b.q - b.r
	return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(aS - bS))
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
 * Returns the axial coordinates of the nth hexagonal tile
 * @deprecated use `ArialRef` and `axial.coords`
 */
export function axialAt(hexIndex: number): Axial {
	if (hexIndex === 0) return { q: 0, r: 0 }
	const radius = Math.floor((3 + Math.sqrt(-3 + 12 * hexIndex)) / 6)
	const previous = 3 * radius * (radius - 1) + 1
	const sidePos = hexIndex - previous
	const side = Math.floor(sidePos / radius)
	return axial.linear([radius, hexSides[side]], [sidePos % radius, hexSides[(side + 2) % 6]])
}

/**
 * Gets the hexIndex from the position
 * @deprecated use `ArialRef` and `axial.index`
 */
export function indexAt({ q, r }: Axial): number {
	if (q === 0 && r === 0) return 0
	const s = -q - r
	const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s))
	const side = [q === ring, r === -ring, s === ring, q === -ring, r === ring, s === -ring].indexOf(
		true
	)
	const offset = [-r, s, -q, r, -s, q][side]
	return 3 * ring * (ring - 1) + side * ring + offset + 1
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

export function cartesian(aRef: AxialRef, size = 1) {
	const { q, r } = axial.coords(aRef)
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
export function genTilePosition(gen: RandGenerator) {
	let [u, v] = [gen(), gen()]
	const s = Math.floor(gen(6))
	if (u + v > 1) [u, v] = [1 - u, 1 - v]
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
	const coords = axial.coords(aRef)
	const outerRadius = radius + 0.5
	const { q, r } = { q: coords.q / outerRadius, r: coords.r / outerRadius }
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

/**
 * Retrieves the tiles around a given tile (indexes) that are within a limit index
 * @returns number[]
 */
export function pointsAround(aRef: AxialRef, nbrTiles: number = Number.POSITIVE_INFINITY) {
	return hexSides
		.map((side) => indexAt(axial.linear([1, aRef], [1, side])))
		.filter((tile) => tile < nbrTiles)
}

export type AxialRef = number | Axial | string
export const axial = {
	/**
	 * Get the axial-ref as an axial: an object `{q, r}`
	 * @returns Axial
	 */
	coords(aRef: AxialRef) {
		if (typeof aRef === 'string') {
			const [q, r] = aRef.split(',')
			return { q: Number(q), r: Number(r) }
		}
		return typeof aRef === 'number' ? axialAt(aRef) : aRef
	},
	/**
	 * Get the axial-ref as an index
	 * @returns number
	 */
	index(aRef: AxialRef) {
		if (typeof aRef === 'string') {
			const [q, r] = aRef.split(',')
			return indexAt({ q: Number(q), r: Number(r) })
		}
		return typeof aRef === 'number' ? aRef : indexAt(aRef)
	},
	/**
	 * Get the axial-ref as a key
	 * @returns string
	 */
	key(aRef: AxialRef) {
		if (typeof aRef === 'number') {
			const { q, r } = axialAt(aRef)
			return `${q},${r}`
		}
		return typeof aRef === 'string' ? aRef : `${aRef.q},${aRef.r}`
	},
	/**
	 * Addition a list of axial coordinates optionally with a scalar coefficient
	 * @param args [coef, AxialRef] Scalar coefficient and axial to multiply/add
	 * @param args AxialRef Axial to add
	 * @returns Axial
	 */
	linear(...args: ([number, AxialRef] | AxialRef)[]): Axial {
		return args.reduce<Axial>(
			(acc, term) => {
				const [coef, aRef] = Array.isArray(term) ? term : [1, term]
				const { q, r } = axial.coords(aRef)
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
		if (typeof aRef !== 'object') return [0, '0,0'].includes(aRef)
		const { q, r } = axial.coords(aRef)
		return q === 0 && r === 0
	},

	lerp(a: Axial, b: Axial, t: number) {
		// epsilon to avoid straight mid-points (point exactly on the line between 2 hexagons)
		return { q: lerp(a.q + 1e-6, b.q + 2e-6, t), r: lerp(a.r, b.r, t) }
	},

	round({ q, r }: Axial) {
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
}
