import { type Axial, type AxialKey, type AxialRef, axial, hexSides } from '~/utils/axial'

export function straightPath(fromTile: AxialRef, toTile: AxialRef) {
	const from = axial.coord(fromTile)
	const to = axial.coord(toTile)
	const rv: Axial[] = []
	const dist = axial.distance(from, to)
	for (let i = 0; i < dist; i++) rv.push(axial.round(axial.lerp(from, to, (i + 1) / dist)))
	return rv
}

export type IsFound = (aRef: AxialKey) => boolean
/**
 * Cost function: Gets the cost from a tile to another
 * - Strictly positive
 * - NaN if no path
 */
export type Cost = (from: AxialKey, to: AxialKey) => number

type HexCost<O = AxialKey> = { key: O; cost: number }

// TODO: add list of shortcuts like train-stations
const epsilon = 1e-6
export function costingPath(fromTile: AxialRef, cost: Cost, isFound: IsFound) {
	const fromKey = axial.key(fromTile)
	if (isFound(fromKey)) return [fromKey]
	const toStudy: HexCost[] = [{ key: fromKey, cost: 0 }]
	const origins = new Map<AxialKey, HexCost<AxialKey | null>>([[fromKey, { key: null, cost: 0 }]])
	let found: { tile: AxialKey; cost: number } | undefined
	while (toStudy.length && (!found || found.cost > toStudy[0].cost)) {
		const study = toStudy.shift()!
		const coord = axial.coord(study.key)
		for (const hexSide of hexSides) {
			const next = axial.key(axial.linear([1, coord], [1, hexSide]))
			if (next !== origins.get(study.key)?.key) {
				let nextCost = cost(study.key, next)
				if (Number.isNaN(nextCost)) continue
				if (nextCost < 0) throw new Error('negative or null cost')
				if (nextCost === 0) nextCost = epsilon
				const pathCost = study.cost + nextCost
				if (isFound(next) && (!found || found.cost > pathCost))
					found = { tile: next, cost: pathCost }
				if (!origins.has(next) || origins.get(next)!.cost > pathCost) {
					if (origins.has(next)) {
						const tsIndex = toStudy.findIndex((ts) => ts.key === next)
						if (tsIndex !== -1) toStudy.splice(tsIndex, 1)
					}
					origins.set(next, { key: study.key, cost: pathCost })
					// add in toStudy
					let i: number
					for (i = 0; i < toStudy.length; i++) if (toStudy[i].cost > pathCost) break
					toStudy.splice(i, 0, { key: next, cost: pathCost })
				}
			}
		}
	}
	if (!found) return null
	const path: AxialKey[] = [found.tile]
	let origin = origins.get(found.tile)!
	while (origin.key !== null) {
		path.push(origin.key)
		origin = origins.get(origin.key)!
	}
	return path.reverse()
}
