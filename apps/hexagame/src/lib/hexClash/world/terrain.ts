import {
	type ContentTile,
	type Land,
	PerlinTerrain,
	type ResourcefulTerrain,
	type SeamlessTextureTerrain,
	type TerrainKey,
} from 'hexaboard'
import { RepeatWrapping, TextureLoader } from 'three'
import { Rock, Tree } from './handelable'

export type HexClashTile = ContentTile
export type HexClashLand = Land<HexClashTile>
const textureLoader = new TextureLoader()
function assetTexture(asset: string) {
	return (type: string) => {
		const texture = textureLoader.load(`./assets/${asset}/${type}.jpg`)
		texture.wrapS = texture.wrapT = RepeatWrapping
		return texture
	}
}

const terrainTexture = assetTexture('terrain')

export const terrainHeight = 100
export const seaLevel = 20
const mountainsFrom = 80

export const terrainTypes: Record<TerrainKey, SeamlessTextureTerrain & ResourcefulTerrain> = {
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		texture: terrainTexture('grass'),
		inTextureRadius: 0.2,
		resourceDistribution: [
			[Tree, 0.1],
			[Rock, 0.1],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		texture: terrainTexture('forest'),
		inTextureRadius: 0.2,
		resourceDistribution: [
			[Tree, 5],
			[Rock, 0.5],
		],
		walkTimeMultiplier: 1.3,
	},
	stone: {
		color: { r: 0.6, g: 0.4, b: 0.1 },
		texture: terrainTexture('stone'),
		inTextureRadius: 0.2,
		resourceDistribution: [[Rock, 3]],
		walkTimeMultiplier: 1.5,
	},
	river: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('river_bed'),
		inTextureRadius: 0.6,
		resourceDistribution: [[Rock, 1]],
	},
}
/* TODO: redo
export function terrainFactory(seed: number) {
	return new PerlinTerrain<HexClashTile, 'height' | 'type' | 'rocky'>(
		seed,
		{
			height: {
				variation: [0, 100],
				scale: 1000,
			},
			type: {
				variation: [-1, 1],
				scale: 500,
			},
			rocky: {
				variation: [-1, 1],
				scale: 100,
			},
		},
		(from, generation) => {
			if (generation.height > mountainsFrom) {
				return {
					...from,
					position: {
						...from.position,
						z: generation.height + generation.rocky * (generation.height - mountainsFrom) * 2,
					},
					terrain: 'stone',
				}
			}
			if (generation.height < seaLevel) {
				return {
					...from,
					position: {
						...from.position,
						z: generation.height,
					},
					terrain: 'river',
				}
			}
			return {
				...from,
				position: {
					...from.position,
					z: generation.height,
				},
				terrain: generation.type > 0 ? 'forest' : 'grass',
			}
		}
	)
}
*/