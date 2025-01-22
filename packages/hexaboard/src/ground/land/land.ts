import { Group } from 'three'
import type { AxialRef } from '~/main'
import type { LandscapeBase } from '../landscape'
import type { ProceduralBase } from '../procedural'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { TerrainBase, TerrainDefinition } from '../terrain'

export interface LandInit<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> {
	terrains: TerrainDefinition<Terrain>
	procedural: ProceduralBase<Tile>
	landscape: LandscapeBase
	seed: number
}

export class LandBase<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> {
	public readonly group = new Group()

	public readonly terrains: TerrainDefinition<Terrain>
	public readonly procedural: ProceduralBase<Tile>
	public readonly landscape: LandscapeBase
	public readonly seed: number

	constructor(init: LandInit<Terrain, Tile>) {
		this.terrains = init.terrains
		this.procedural = init.procedural
		this.landscape = init.landscape
		this.seed = init.seed
	}
	progress(dt: number) {}
	tileSector(aRef: AxialRef): { sector: Sector; hexIndex: number } {
		throw new Error('Not implemented')
	}
	tileCenter(aRef: AxialRef) {
		const { sector, hexIndex } = this.tileSector(aRef)
		return this.landscape.tileCenter(sector, hexIndex)
	}
	addedSector(sector: Sector) {
		if (!sector.ground) sector.landscape(this.landscape.createMesh(sector))
		this.group.add(sector.group)
	}
	removeSector(sector: Sector) {
		this.group.remove(sector.group)
	}
}
