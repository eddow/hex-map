import { subSeed } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { LandPart, TileBase } from './land'

/**
 * Really simple Perlin noise procedural
 * @todo Make a real terrain generator out of it
 */
export class PerlinHeight<Tile extends TileBase = TileBase> implements LandPart<Tile> {
	readonly perlin: HeightMap
	constructor(
		private readonly terrainHeight: number,
		private readonly seed: number,
		scale = 10
	) {
		this.perlin = new HeightMap(subSeed(seed, 'perlinH'), scale, [0, terrainHeight])
	}
	refineTile(tile: TileBase): Tile {
		const { x, y } = tile.position
		const z = this.perlin.getHeight(x, y)
		return {
			...tile,
			position: { ...tile.position, z },
		} as Tile
	}
}
