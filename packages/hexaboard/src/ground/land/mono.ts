import { LCG, subSeed } from '~/utils/numbers'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandBase, type LandInit } from './land'

export class MonoSectorLand<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends LandBase<Terrain, Tile> {
	public readonly sector: Sector
	constructor(init: LandInit<Terrain, Tile>) {
		super(init)
		this.sector = this.createSector(
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
