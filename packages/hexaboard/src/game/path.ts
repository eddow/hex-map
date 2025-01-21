import {
	type Axial,
	axialAt,
	axialDistance,
	axialIndex,
	axialLerp,
	axialPolynomial,
	axialRound,
	hexSides,
} from '~/ground/hexagon'
import type Sector from '~/ground/sector'

export function nextInPath(fromSector: Sector, fromTile: number, toSector: Sector, toTile: number) {
	if (fromSector !== toSector)
		throw new Error('from and to sectors must be the same: not implemented yet')
	const from = axialAt(fromTile)
	const to = axialAt(toTile)
	return axialRound(axialLerp(from, to, 1 / axialDistance(from, to)))
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
	for (let i = 0; i < dist; i++) rv.push(axialRound(axialLerp(from, to, (i + 1) / dist)))
	return rv
}

export type IsFound = (hexIndex: number) => boolean
export type Cost = (from: number, to: number) => number

type HexCost<O = number> = { hexIndex: O; cost: number }

export function costingPath(fromTile: number, cost: Cost, isFound: IsFound) {
	if (isFound(fromTile)) return [fromTile]
	const toStudy: HexCost[] = [{ hexIndex: fromTile, cost: 0 }]
	const origins: { [hexIndex: number]: HexCost<number | null> } = {
		[fromTile]: { hexIndex: null, cost: 0 },
	}
	let found: { hexIndex: number; cost: number } | undefined
	while (toStudy.length && (!found || found.cost > toStudy[0].cost)) {
		const study = toStudy.shift()!
		const axial = axialAt(study.hexIndex)
		for (const hexSide of hexSides) {
			const hexIndex = axialIndex(axialPolynomial([1, axial], [1, hexSide]))
			if (hexIndex !== origins[study.hexIndex].hexIndex) {
				const nextCost = cost(study.hexIndex, hexIndex)
				if (Number.isNaN(nextCost)) continue
				const pathCost = study.cost + nextCost
				if (isFound(hexIndex) && (!found || found.cost > pathCost))
					found = { hexIndex, cost: pathCost }
				if (!origins[hexIndex] || origins[hexIndex].cost > pathCost) {
					if (origins[hexIndex]) {
						const tsIndex = toStudy.findIndex((ts) => ts.hexIndex === hexIndex)
						if (tsIndex !== -1) toStudy.splice(tsIndex, 1)
					}
					origins[hexIndex] = { hexIndex: study.hexIndex, cost: pathCost }
					// add in toStudy
					let i: number
					for (i = 0; i < toStudy.length; i++) if (toStudy[i].cost > pathCost) break
					toStudy.splice(i, 0, { hexIndex, cost: pathCost })
				}
			}
		}
	}
	if (!found) return null
	const path: number[] = [found.hexIndex]
	let origin = origins[found.hexIndex]
	while (origin.hexIndex !== null) {
		path.push(origin.hexIndex)
		origin = origins[origin.hexIndex]
	}
	return path
}
