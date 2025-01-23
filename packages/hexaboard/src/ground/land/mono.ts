import { LCG, subSeed } from '~/utils/numbers'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandBase, type LandInit } from './land'

export class MonoSectorLand<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends LandBase<Terrain, Tile> {
	public readonly unique: Sector<Tile>
	constructor(init: LandInit<Terrain, Tile>) {
		super(init)
		this.unique = this.createSector(
			this.procedural.listTiles(this, { gen: LCG(this.seed), center: { q: 0, r: 0 } }),
			subSeed(this.seed, 'sector')
		)
		this.addedSector(this.unique)
	}
	sector() {
		return this.unique
	}
}
