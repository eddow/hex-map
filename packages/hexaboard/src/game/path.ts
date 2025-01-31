import {
	type Axial,
	type AxialCoord,
	AxialKeyMap,
	type AxialRef,
	HeapMin,
	axial,
	hexSides,
} from '~/utils'

export function straightPath(fromTile: AxialRef, toTile: AxialRef) {
	const from = axial.coord(fromTile)
	const to = axial.coord(toTile)
	const rv: AxialCoord[] = []
	const dist = axial.distance(from, to)
	for (let i = 0; i < dist; i++) rv.push(axial.round(axial.lerp(from, to, (i + 1) / dist)))
	return rv
}

export type IsFound = (at: Axial) => boolean
/**
 * Cost function: Gets the cost from a tile to another
 * - Strictly positive
 * - NaN if no path
 */
export type Cost = (from: Axial, to: Axial) => number

type HexCost<O = Axial> = { point: O; cost: number }

// TODO: add list of shortcuts like train-stations
const epsilon = 1e-6
export function costingPath(start: AxialRef, cost: Cost, isFound: IsFound, maxCost = 200) {
	const from = axial.access(start)
	if (isFound(from)) return [from]
	const toStudy = new HeapMin([[from, 0 as number]])
	const origins = new AxialKeyMap<HexCost<Axial | null>>([[from.key, { point: null, cost: 0 }]])
	let found: { point: Axial; cost: number } | undefined
	while (!toStudy.isEmpty && (!found || found.cost > toStudy.top!)) {
		const [study, studyCost] = toStudy.pop()!
		for (const hexSide of hexSides) {
			const next = axial.coordAccess(axial.linear([1, study], [1, hexSide]))
			if (next.key !== origins.get(study)?.point?.key) {
				let nextCost = cost(study, next)
				if (Number.isNaN(nextCost)) continue
				if (nextCost < 0) throw new Error('negative or null cost')
				if (nextCost === 0) nextCost = epsilon
				const pathCost = studyCost + nextCost
				if (pathCost > maxCost) continue
				if (isFound(next) && (!found || found.cost > pathCost))
					found = { point: next, cost: pathCost }
				if (!origins.has(next) || origins.get(next)!.cost > pathCost) {
					origins.set(next.key, { point: study, cost: pathCost })
					toStudy.set(next, pathCost)
				}
			}
		}
	}
	if (!found) return null
	const path: Axial[] = [found.point]
	let origin = origins.get(found.point.key)!
	while (origin.point !== null) {
		path.push(origin.point)
		origin = origins.get(origin.point.key)!
	}
	return path.reverse()
}
