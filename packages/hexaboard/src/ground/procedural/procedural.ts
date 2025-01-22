import type { RandGenerator } from '~/utils/numbers'
import { type Axial, hexTiles } from '../../utils/axial'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'

export abstract class ProceduralBase<Tile extends TileBase = TileBase> {
	constructor(
		public readonly radius: number,
		public readonly terrainHeight: number
	) {}
	abstract listTiles(land: LandBase, specs: { gen: RandGenerator; center: Axial }): Tile[]
	/**
	 * Total amount of tiles
	 */
	get nbrTiles() {
		return hexTiles(this.radius)
	}
}
