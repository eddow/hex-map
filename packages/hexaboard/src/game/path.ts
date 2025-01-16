import type HexSector from '~/hexagon/sector'
import { axialAt, axialDistance, axialLerp, axialRound } from '~/hexagon/utils'

export function nextInPath(
	fromSector: HexSector,
	fromTile: number,
	toSector: HexSector,
	toTile: number
) {
	if (fromSector !== toSector)
		throw new Error('from and to sectors must be the same: not implemented yet')
	const from = axialAt(fromTile)
	const to = axialAt(toTile)
	return axialRound(axialLerp(from, to, 1 / axialDistance(from, to)))
}
