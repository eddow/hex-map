import type { Texture } from 'three'
import { subSeed } from '~/utils'
import { HeightMap } from '~/utils/perlin'
import type { Land, LandPart, TileBase } from './land'

export interface Terrain {
	color: { r: number; g: number; b: number }
	appearHeight: number
	texture: Texture
}

export class TerrainDefinition {
	constructor(public readonly types: Record<string, Terrain>) {}
	terrainType(height: number): string {
		let rvH: number | undefined
		let rvT: undefined | string
		for (const type in this.types) {
			const tType = this.types[type as keyof typeof this.types]
			const thisH = tType.appearHeight
			if (height >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = type
			}
		}
		return rvT!
	}
	get textures() {
		return Object.values(this.types).map((t) => t.texture)
	}
}

export interface TerrainTile extends TileBase {
	terrain: string
}

export class HeightTerrain implements LandPart<TerrainTile> {
	readonly perlin: HeightMap
	constructor(
		land: Land<TileBase>,
		private readonly variation: number,
		private readonly seed: number,
		private readonly terrains: TerrainDefinition,
		scale = 10
	) {
		this.perlin = new HeightMap(subSeed(seed, 'terrainH'), scale, [-variation, variation])
		land.addPart(this)
	}
	refineTile(tile: TileBase): TerrainTile {
		const { x, y, z } = tile.position
		const add = this.perlin.getHeight(x, y, 2)
		return {
			...tile,
			terrain: this.terrains.terrainType(z + add),
		}
	}
}
