import {
	type ResourcefulTerrain,
	type RoadBase,
	type RoadKey,
	TerrainDefinition,
	type TerrainKey,
	type TextureTerrain,
} from 'hexaboard'
import { RepeatWrapping, TextureLoader } from 'three'
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

const terrainTypes: Record<TerrainKey, TextureTerrain & ResourcefulTerrain> = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('sand'),
		inTextureRadius: 0.2,
		appearHeight: Number.NEGATIVE_INFINITY,
		//variance: 0.1,
		resourceDistribution: [[Rock, 0.1]],
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		texture: terrainTexture('grass'),
		inTextureRadius: 0.2,
		appearHeight: 75,
		//variance: 0.7,
		resourceDistribution: [
			[Rock, 0.2],
			[Tree, 0.2],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		texture: terrainTexture('forest'),
		inTextureRadius: 0.2,
		appearHeight: 100,
		//variance: 2,
		resourceDistribution: [
			[Rock, 0.1],
			[Tree, 1.5],
		],
	},
	stone: {
		color: { r: 0.6, g: 0.4, b: 0.1 },
		texture: terrainTexture('stone'),
		inTextureRadius: 0.2,
		appearHeight: 115,
		//variance: 3,
		resourceDistribution: [
			[Rock, 1.5],
			[Tree, 0.2],
		],
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		texture: terrainTexture('snow'),
		inTextureRadius: 0.2,
		appearHeight: 130,
		//variance: 1.5,
		resourceDistribution: [[Rock, 0.2]],
	},
	river: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('river_bed'),
		inTextureRadius: 0.6,
		//variance: 0.1,
		resourceDistribution: [[Rock, 1]],
	},
}

export const terrains = new TerrainDefinition(terrainTypes)

export const roadTypes: Record<RoadKey, RoadBase> = {
	hc: {
		width: 0.05,
		blend: 0.07,
		color: { r: 0.8, g: 0.8, b: 0 },
		//texture: roadTexture('4lanes'),
	},
}

//export const terrains = new TerrainDefinition(terrainTypes)
