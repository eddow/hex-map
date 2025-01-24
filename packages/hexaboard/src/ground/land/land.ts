import { Group, type Vector3 } from 'three'
import type { AxialRef } from '~/utils'
import type { LandscapeBase } from '../landscape'
import type { ProceduralBase } from '../procedural'
import type { TileBase } from '../sector'
import Sector from '../sector'
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
	createSector(center: AxialRef, tiles: Tile[], seed: number, ...args: any[]) {
		return new Sector(center, this, tiles, seed)
	}
	progress(dt: number) {}
	addedSector(sector: Sector) {
		if (!sector.ground) sector.landscape(this.landscape.createMesh(sector))
		this.group.add(sector.group)
	}
	removeSector(sector: Sector) {
		this.group.remove(sector.group)
	}
	/**
	 * Called when the views have moved
	 * @param cameras List of camera positions
	 */
	updateViews(cameras: Vector3[]) {}
	sector(...args: any[]): Sector<Tile> {
		throw new Error('Not implemented')
	}
	sectorAt(aRef: AxialRef): Sector<Tile> | null {
		throw new Error('Not implemented')
	}
	/* TODO: tileHandle(aRef: AxialRef) {
		return new TileHandle(this, this.sectorAt(aRef)!, this.landscape.hexIndex(aRef))
	}*/
}
