import { type AxialRef, LCG, axial, cartesian } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { TileNature } from './land'
import type { TerrainDefinition } from './terrain'

/**
 * Really simple Perlin noise procedural
 * @todo Make a real terrain generator out of it
 */
export class NatureGenerator {
	readonly perlin: HeightMap
	constructor(
		terrainHeight: number,
		public readonly terrains: TerrainDefinition,
		public readonly worldSeed: number,
		public readonly tileSize: number,
		scale = 10
	) {
		this.perlin = new HeightMap(worldSeed, scale, [0, terrainHeight])
	}
	getNature(tile: AxialRef): TileNature {
		const { x, y } = cartesian(axial.coords(tile))
		const z = this.perlin.getHeight(x, y)
		const gen = LCG(this.worldSeed, 'color', x, y)
		return {
			position: { x: x * this.tileSize, y: y * this.tileSize, z },
			terrain: this.terrains.terrainType(z),
			color: {
				r: gen(),
				g: gen(),
				b: gen(),
			},
		}
	}
}
