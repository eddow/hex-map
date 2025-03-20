import {
	type ColorRoad,
	type ResourcefulTerrain,
	type RoadKey,
	type SeamlessTextureTerrain,
	type TerrainKey,
	PerlinTerrain,
} from 'hexaboard'
import { RepeatWrapping, TextureLoader } from 'three'
import type { GameXTile } from '../game'
import { Rock, Tree } from './handelable'

const textureLoader = new TextureLoader()
function assetTexture(asset: string) {
	return (type: string) => {
		const texture = textureLoader.load(`./assets/${asset}/${type}.jpg`)
		texture.wrapS = texture.wrapT = RepeatWrapping
		return texture
	}
}

const terrainTexture = assetTexture('terrain')
const roadTexture = assetTexture('road')

export const terrainHeight = 160
export const seaLevel = 70

export const terrainTypes: Record<TerrainKey, SeamlessTextureTerrain & ResourcefulTerrain> = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('sand'),
		inTextureRadius: 0.2,
		resourceDistribution: [[Rock, 0.1]],
		walkTimeMultiplier: 1.1,
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		texture: terrainTexture('grass'),
		inTextureRadius: 0.2,
		resourceDistribution: [
			[Rock, 0.2],
			[Tree, 0.2],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		texture: terrainTexture('forest'),
		inTextureRadius: 0.2,
		resourceDistribution: [
			[Rock, 0.1],
			[Tree, 1.5],
		],
		walkTimeMultiplier: 1.3,
	},
	stone: {
		color: { r: 0.6, g: 0.4, b: 0.1 },
		texture: terrainTexture('stone'),
		inTextureRadius: 0.2,
		resourceDistribution: [
			[Rock, 1.5],
			[Tree, 0.2],
		],
		walkTimeMultiplier: 1.5,
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		texture: terrainTexture('snow'),
		inTextureRadius: 0.2,
		resourceDistribution: [[Rock, 0.2]],
		walkTimeMultiplier: 2,
	},
	river: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('river_bed'),
		inTextureRadius: 0.6,
		resourceDistribution: [[Rock, 1]],
	},
}

export const roadTypes: Record<RoadKey, ColorRoad> = {
	hc: {
		width: 0.05,
		blend: 0.07,
		color: { r: 0.8, g: 0.8, b: 0 },
		//texture: roadTexture('4lanes'),
		walkTimeMultiplier: 0.8,
	},
}

const mountainsFrom = 130

export function terrainFactory(seed: number) {
	return new PerlinTerrain<GameXTile, 'height' | 'terrainType' | 'rocky'>(
		{
			height: {
				variation: [0, 160],
				scale: .001,
			},
			terrainType: {
				variation: [-1, 1],
				scale: .002,
			},
			rocky: {
				variation: [-1, 1],
				scale: .01,
			},
		},
		(from, generation) => {
			const isMountain = generation.height > mountainsFrom
			if (isMountain) {
				return {
					...from,
					position: {
						...from.position,
						z: generation.height + generation.rocky * (generation.height - mountainsFrom),
					},
					terrain: generation.height > 155 ? 'snow' : 'stone',
				} as GameXTile
			}
			const z = generation.height
			return (
				z > 75
					? {
							...from,
							position: {
								...from.position,
								z,
							},
							terrain: generation.terrainType > 0 ? 'forest' : 'grass',
						}
					: {
							...from,
							position: {
								...from.position,
								z,
							},
							terrain: 'sand',
						}
			) as GameXTile
		}
	)
}
