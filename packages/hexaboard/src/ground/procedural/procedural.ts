import type { RandGenerator } from '~/utils/numbers'
import { hexTiles } from '../hexagon'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'

export abstract class ProceduralBase<Tile extends TileBase = TileBase> {
	constructor(
		public readonly radius: number,
		public readonly terrainHeight: number
	) {}
	abstract listTiles(land: LandBase, gen: RandGenerator): Tile[]
	/**
	 * Total amount of tiles
	 */
	get nbrTiles() {
		return hexTiles(this.radius)
	}
}
