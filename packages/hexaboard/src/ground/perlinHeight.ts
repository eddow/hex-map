import { Eventful, subSeed } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { LandPart, RenderedEvents, TileBase, WalkTimeSpecification } from './land'

/**
 * Really simple Perlin noise procedural
 * @todo Make a real terrain generator out of it
 */
export class PerlinHeight<Tile extends TileBase = TileBase>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile>
{
	readonly perlin: HeightMap
	constructor(
		private readonly terrainHeight: number,
		private readonly seed: number,
		scale = 10
	) {
		super()
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
	// TODO: pass a user-parameter (no-resource-clean, no-road, ...)
	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number | undefined {
		// TODO: Slope multiplier
		return 1
	}
}
