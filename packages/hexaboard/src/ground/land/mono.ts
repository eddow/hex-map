import { type AxialRef, axial } from '~/utils/axial'
import { LCG, subSeed } from '~/utils/numbers'
import type { TileBase } from '../sector'
import Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandBase, type LandInit } from './land'

export class MonoSectorLand<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends LandBase<Terrain, Tile> {
	tileSector(aRef: AxialRef) {
		return { sector: this.sector, hexIndex: axial.index(aRef) }
	}
	public readonly sector: Sector
	constructor(init: LandInit<Terrain, Tile>) {
		super(init)
		this.sector = new Sector(
			this,
			this.procedural.listTiles(this, { gen: LCG(this.seed), center: { q: 0, r: 0 } }),
			subSeed(this.seed, 'sector')
		)
		this.addedSector(this.sector)
	}

	/**
	 * @deprecated Should be replaced and see how it's needed
	 */
	get tileSize() {
		return this.landscape.tileSize
	}
}
