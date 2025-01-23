import { type Face, Group, type Intersection, type Object3D, type Object3DEventMap } from 'three'
import { type AxialRef, axial } from '~/main'
import { LCG } from '~/utils'
import { type MouseReactive, TileHandle } from '~/utils/mouseControl'
import type { LandBase } from './land/land'
import type { TerrainBase } from './terrain'

export interface TileBase<Terrain extends TerrainBase = TerrainBase> {
	z: number
	terrain: Terrain
}

export default class Sector<Tile extends TileBase = TileBase> implements MouseReactive {
	constructor(
		public readonly land: LandBase,
		public readonly tiles: Tile[],
		public readonly seed: number
	) {}
	group: Group = new Group()
	ground?: Object3D

	mouseHandle(intersection: Intersection<Object3D<Object3DEventMap>>): TileHandle {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		// TODO: It should be calculated and therefore not reference this.land.landscape
		return new TileHandle(this, this.land.landscape.hexIndex(geomPt))
	}

	/**
	 * Total amount of tiles
	 * Overridden by `PuzzleSector` for common tiles management
	 */
	get nbrTiles() {
		return this.tiles.length
	}
	worldTile(aRef: AxialRef) {
		return axial.coords(aRef)
	}

	/**
	 * Generate the terrain mesh
	 */
	landscape(terrain: Object3D) {
		if (this.ground) this.group.remove(this.ground)
		this.ground = terrain
		this.group.add(this.ground)
	}

	// #region forward helpers

	tileCenter(aRef: AxialRef) {
		return this.land.landscape.worldTileCenter(this, axial.index(aRef))
	}

	tileGen(aRef: AxialRef, ...otherArgs: (number | string)[]) {
		return LCG(this.seed, 'tile', axial.index(aRef), ...otherArgs)
	}

	get key(): PropertyKey {
		return 'sector'
	}
}
