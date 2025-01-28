import { type Axial, type AxialKey, type AxialRef, axial, hexSides } from '~/utils/axial'

export function straightPath(fromTile: AxialRef, toTile: AxialRef) {
	const from = axial.coords(fromTile)
	const to = axial.coords(toTile)
	const rv: Axial[] = []
	const dist = axial.distance(from, to)
	for (let i = 0; i < dist; i++) rv.push(axial.round(axial.lerp(from, to, (i + 1) / dist)))
	return rv
}

export type IsFound = (aRef: string) => boolean
/**
 * Cost function: Gets the cost from a tile to another
 * - Strictly positive
 * - NaN if no path
 */
export type Cost = (from: string, to: string) => number

type HexCost<O = string> = { key: O; cost: number }

// TODO: add list of shortcuts like train-stations
const epsilon = 1e-6
export function costingPath(fromTile: AxialRef, cost: Cost, isFound: IsFound) {
	const fromKey = axial.key(fromTile)
	if (isFound(fromKey)) return [fromKey]
	const toStudy: HexCost[] = [{ key: fromKey, cost: 0 }]
	// TODO: origins -> Map?
	const origins: { [tile: string]: HexCost<string | null> } = {
		[fromKey]: { key: null, cost: 0 },
	}
	let found: { tile: string; cost: number } | undefined
	while (toStudy.length && (!found || found.cost > toStudy[0].cost)) {
		const study = toStudy.shift()!
		const coords = axial.coords(study.key)
		for (const hexSide of hexSides) {
			const next = axial.key(axial.linear([1, coords], [1, hexSide]))
			if (next !== origins[study.key].key) {
				let nextCost = cost(study.key, next)
				if (Number.isNaN(nextCost)) continue
				if (nextCost < 0) throw new Error('negative or null cost')
				if (nextCost === 0) nextCost = epsilon
				const pathCost = study.cost + nextCost
				if (isFound(next) && (!found || found.cost > pathCost))
					found = { tile: next, cost: pathCost }
				if (!origins[next] || origins[next].cost > pathCost) {
					if (origins[next]) {
						const tsIndex = toStudy.findIndex((ts) => ts.key === next)
						if (tsIndex !== -1) toStudy.splice(tsIndex, 1)
					}
					origins[next] = { key: study.key, cost: pathCost }
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
	let origin = origins[found.tile]
	while (origin.key !== null) {
		path.unshift(origin.key)
		origin = origins[origin.key]
	}
	return path
}
