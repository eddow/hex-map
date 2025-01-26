import { LCG } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { Land, LandPart, TileBase } from './land'

/**
 * Really simple Perlin noise procedural
 * @todo Make a real terrain generator out of it
 */
export class PerlinHeight implements LandPart<TileBase> {
	readonly perlin: HeightMap
	constructor(
		land: Land<TileBase>,
		public readonly terrainHeight: number,
		public readonly seed: number,
		scale = 10
	) {
		this.perlin = new HeightMap(LCG(seed, 'perlinH')(), scale, [0, terrainHeight])
		land.addPart(this)
	}
	refineTile(tile: TileBase): TileBase {
		const { x, y } = tile.position
		const z = this.perlin.getHeight(x, y)
		return {
			...tile,
			position: { ...tile.position, z },
		}
	}
}
