import { RepeatWrapping, type Texture, TextureLoader } from 'three'
import { type ResourceDistribution, Rock, Tree } from './handelable'

const textureLoader = new TextureLoader()
function terrainTexture(type: string) {
	const texture = textureLoader.load(`/assets/terrain/${type}.png`)
	texture.wrapS = texture.wrapT = RepeatWrapping
	return texture
}
export const wholeScale = 80
export type Terrain = keyof typeof terrainTypes
export interface TerrainType {
	color: { r: number; g: number; b: number }
	appearHeight: number
	variance: number
	resourceDistribution: ResourceDistribution
	texture: Texture
}
export const waterTexture = terrainTexture('water')

export const terrainTypes: Record<string, TerrainType> = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('sand'),
		appearHeight: Number.NEGATIVE_INFINITY,
		variance: 0.1,
		resourceDistribution: [[Rock, 0.1]],
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		texture: terrainTexture('grass'),
		appearHeight: 0.1,
		variance: 0.7,
		resourceDistribution: [
			[Rock, 0.2],
			[Tree, 0.2],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		texture: terrainTexture('forest'),
		appearHeight: 0.4,
		variance: 2,
		resourceDistribution: [
			[Rock, 0.1],
			[Tree, 1.5],
		],
	},
	stone: {
		color: { r: 0.6, g: 0.4, b: 0.1 },
		texture: terrainTexture('stone'),
		appearHeight: 0.7,
		variance: 3,
		resourceDistribution: [
			[Rock, 1.5],
			[Tree, 0.2],
		],
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		texture: terrainTexture('snow'),
		appearHeight: 0.9,
		variance: 1.5,
		resourceDistribution: [[Rock, 0.2]],
	},
}

export function terrainType(height: number): TerrainType {
	let rvH: number | undefined
	let rvT: undefined | TerrainType
	for (const type in terrainTypes) {
		const tType = terrainTypes[type as Terrain]
		const thisH = tType.appearHeight
		if (height / wholeScale >= thisH && (rvH === undefined || thisH > rvH)) {
			rvH = thisH
			rvT = tType
		}
	}
	return rvT!
}
