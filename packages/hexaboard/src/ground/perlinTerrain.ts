import type { Pair } from '~/types'
import { Eventful, subSeed } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { LandPart, RenderedEvents, TileBase, WalkTimeSpecification } from './land'

export type TerrainKey = PropertyKey

export interface TerrainBase {
	color: { r: number; g: number; b: number }
	walkTimeMultiplier?: number
}

export interface TerrainTile extends TileBase {
	terrain: TerrainKey
}

export interface PerlinConfiguration {
	/**
	 * How zoomed ou a terrain look. A small number will bring very varying small details while a big number will make big smooth surfaces
	 * Usually, two peaks will be separated by 5~10 * scale
	 * @default 1
	 */
	scale?: number
	/**
	 * More octaves bring more small variations (and more calculus)
	 * @default 3
	 */
	octaves?: number
	/**
	 * [min, max] of the expected number
	 * @default [0,1]
	 */
	variation: Pair<number>
}

export class PerlinTerrain<Tile extends TileBase, Keys extends PropertyKey>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile>
{
	private generators: Record<Keys, HeightMap>

	constructor(
		seed: number,
		configurations: Record<Keys, PerlinConfiguration>,
		private readonly calculus: (from: TileBase, generation: Record<Keys, number>) => Tile,
		public readonly walkTimeMultiplier: (
			movement: WalkTimeSpecification<Tile>
		) => number | undefined = () => undefined
	) {
		super()
		this.generators = {} as Record<Keys, HeightMap>
		for (const key in configurations) {
			const config = configurations[key]
			this.generators[key as Keys] = new HeightMap(
				subSeed(seed, 'perlin', key),
				config.scale ?? 1,
				config.variation ?? [0, 1],
				config.octaves ?? 3
			)
		}
	}
	refineTile(tile: TileBase): Tile {
		const subGen: Record<Keys, number> = {} as Record<Keys, number>
		const { generators } = this
		for (const key in generators) {
			Object.defineProperty(subGen, key, {
				// Calculate perlin only when needed + cache
				get() {
					const rv = generators[key as Keys].getHeight(tile.position.x, tile.position.z)
					Object.defineProperty(subGen, key, { value: rv })
					return rv
				},
				configurable: true,
			})
		}
		return this.calculus(tile, subGen)
	}
}
