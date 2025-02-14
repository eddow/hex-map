import { type Axial, type AxialRef, type Sector, axial } from 'hexaboard'
import type { Vector3Like } from 'three'
import type { HexClashTile } from '../world/terrain'
import { type PawnType, pawnHealth } from './constants'

export class SquadMember {
	public position: Vector3Like
	constructor(public squad: Squad) {
		this.position = squad.center
	}
}

export class Squad {
	pawns = new Set<SquadMember>()
	point: Axial
	public center: Vector3Like
	constructor(
		private sector: Sector<HexClashTile>,
		point: AxialRef,
		public readonly type: PawnType,
		public stamina = pawnHealth,
		public moral = pawnHealth,
		pawns = 6
	) {
		this.point = axial.access(point)
		this.center = sector.tile(this.point).position
		for (let i = 0; i < pawns; i++) this.pawns.add(new SquadMember(this))
	}
}
