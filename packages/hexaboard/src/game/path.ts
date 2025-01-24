import type Sector from '~/ground/sector'
import { type Axial, type AxialRef, axial, axialAt, axialDistance, hexSides } from '~/utils/axial'

export function nextInPath(fromSector: Sector, fromTile: number, toSector: Sector, toTile: number) {
	if (fromSector !== toSector)
		throw new Error('from and to sectors must be the same: not implemented yet')
	const from = axialAt(fromTile)
	const to = axialAt(toTile)
	return axial.round(axial.lerp(from, to, 1 / axialDistance(from, to)))
}

export function straightPath(
	fromSector: Sector,
	fromTile: number,
	toSector: Sector,
	toTile: number
) {
	if (fromSector !== toSector)
		throw new Error('from and to sectors must be the same: not implemented yet')
	const from = axialAt(fromTile)
	const to = axialAt(toTile)
	const rv: Axial[] = []
	const dist = axialDistance(from, to)
	for (let i = 0; i < dist; i++) rv.push(axial.round(axial.lerp(from, to, (i + 1) / dist)))
	return rv
}

export type IsFound = (aRef: AxialRef) => boolean
export type Cost = (from: AxialRef, to: AxialRef) => number

type HexCost<O = string> = { key: O; cost: number }

// TODO: add list of shortcuts like train-stations
export function costingPath(fromTile: AxialRef, cost: Cost, isFound: IsFound) {
	if (isFound(fromTile)) return [fromTile]
	const toStudy: HexCost[] = [{ key: axial.key(fromTile), cost: 0 }]
	const origins: { [tile: string]: HexCost<string | null> } = {
		[axial.key(fromTile)]: { key: null, cost: 0 },
	}
	let found: { tile: string; cost: number } | undefined
	while (toStudy.length && (!found || found.cost > toStudy[0].cost)) {
		const study = toStudy.shift()!
		const coords = axial.coords(study.key)
		for (const hexSide of hexSides) {
			const next = axial.key(axial.linear([1, coords], [1, hexSide]))
			if (next !== origins[study.key].key) {
				const nextCost = cost(study.key, next)
				if (Number.isNaN(nextCost)) continue
				if (nextCost <= 0) throw new Error('negative or null cost')
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
	const path: string[] = [found.tile]
	let origin = origins[found.tile]
	while (origin.key !== null) {
		path.push(origin.key)
		origin = origins[origin.key]
	}
	return path
}
