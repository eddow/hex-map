import { type Group, Vector3 } from 'three'
import { LCG, subSeed } from '~/utils/numbers'
import type { LandscapeBase } from '../landscape'
import type { ProceduralBase } from '../procedural'
import type { TileBase } from '../sector'
import Sector from '../sector'
import type { TerrainBase, TerrainDefinition } from '../terrain'
import { LandBase } from './land'

export class MonoSectorLand<
	Tile extends TileBase = TileBase,
	Terrain extends TerrainBase = TerrainBase,
> extends LandBase<Tile, Terrain> {
	public readonly sector: Sector
	constructor(
		public readonly terrains: TerrainDefinition<Terrain>,
		public readonly procedural: ProceduralBase<Tile>,
		public readonly landscape: LandscapeBase,
		public readonly seed: number
	) {
		super(terrains, procedural, landscape)
		this.sector = new Sector(
			this,
			procedural.listTiles(this, LCG(seed)),
			subSeed(seed, 'sector'),
			new Vector3(0, 0, 0)
		)
	}

	/**
	 * @obsolete Should be replaced and see how it's needed
	 */
	get tileSize() {
		return this.landscape.tileSize
	}
	get group(): Group {
		if (!this.sector.ground) this.sector.landscape(this.landscape.createMesh(this.sector))
		return this.sector.group
	}
}
