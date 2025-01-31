import { Eventful, subSeed } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { LandPart, RenderedEvents, TileBase, WalkTimeSpecification } from './land'

export type TerrainKey = PropertyKey

export interface TerrainBase {
	color: { r: number; g: number; b: number }
	appearHeight?: number
	walkTimeMultiplier?: number
}

export interface TerrainTile extends TileBase {
	terrain: TerrainKey
}

export class TerrainDefinition<Terrain extends TerrainBase = TerrainBase> {
	constructor(public readonly types: Record<TerrainKey, Terrain>) {}
	terrainType(height: number): TerrainKey {
		let rvH: number | undefined
		let rvT: undefined | TerrainKey
		for (const type in this.types) {
			const tType = this.types[type as keyof typeof this.types]
			const thisH = tType.appearHeight
			if (thisH !== undefined && height >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = type
			}
		}
		return rvT!
	}
}

export class HeightTerrain<Tile extends TerrainTile = TerrainTile>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile>
{
	readonly perlin: HeightMap
	constructor(
		private readonly variation: number,
		private readonly seed: number,
		private readonly terrains: TerrainDefinition,
		scale = 10
	) {
		super()
		this.perlin = new HeightMap(subSeed(seed, 'terrainH'), scale, [-variation, variation])
	}
	refineTile(tile: TileBase): Tile {
		const { x, y, z } = tile.position
		const add = this.perlin.getHeight(x, y, 2)
		return {
			...tile,
			terrain: this.terrains.terrainType(z + add),
		} as Tile
	}
	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number | undefined {
		return this.terrains.types[movement.on.terrain].walkTimeMultiplier
	}
}
