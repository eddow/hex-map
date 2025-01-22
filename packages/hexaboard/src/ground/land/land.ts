import type { Group } from 'three'
import type { AxialRef } from '~/main'
import type { LandscapeBase } from '../landscape'
import type { ProceduralBase } from '../procedural'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { TerrainBase, TerrainDefinition } from '../terrain'

export abstract class LandBase<
	Tile extends TileBase = TileBase,
	Terrain extends TerrainBase = TerrainBase,
> {
	constructor(
		public readonly terrains: TerrainDefinition<Terrain>,
		public readonly procedural: ProceduralBase<Tile>,
		public readonly landscape: LandscapeBase
	) {}
	progress(dt: number) {}
	abstract get group(): Group
	abstract tileSector(aRef: AxialRef): { sector: Sector; hexIndex: number }
	tileCenter(aRef: AxialRef) {
		const { sector, hexIndex } = this.tileSector(aRef)
		return this.landscape.tileCenter(sector, hexIndex)
	}
}
