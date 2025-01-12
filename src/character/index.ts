import type { Mesh } from 'three'
import type HexSector from '~/hexagon/section'
import { type Axial, axialIndex } from '~/hexagon/utils'
import { vSum } from '~/utils/vectors'

export interface CharacterAction {
	advance(dt: number, character: Character): number
}

export const idle = { advance: () => 0 }

export class Character {
	public action: CharacterAction = idle
	constructor(
		public sector: HexSector,
		public axial: Axial,
		public mesh: Mesh
	) {
		mesh.position.copy(vSum(sector.vPosition(axialIndex(axial)), sector.measures.position))
	}
}

class GotoAction {
	//constructor(character: Character, sector) {}
	advance(dt: number) {}
}
