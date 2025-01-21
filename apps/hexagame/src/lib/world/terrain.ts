import { TerrainDefinition, type TexturedTerrain } from 'hexaboard'
import { RepeatWrapping, TextureLoader } from 'three'
import { Rock, Tree } from './handelable'

const textureLoader = new TextureLoader()
function terrainTexture(type: string) {
	const texture = textureLoader.load(`/assets/terrain/${type}.png`)
	texture.wrapS = texture.wrapT = RepeatWrapping
	return texture
}
export const terrainHeight = 80
export const waterTexture = terrainTexture('water')

type Terrain = TexturedTerrain & { [key: string]: any }

export const terrainTypes: Record<string, Terrain> = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		texture: terrainTexture('sand'),
		appearHeight: 0,
		variance: 0.1,
		resourceDistribution: [[Rock, 0.1]],
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		texture: terrainTexture('grass'),
		appearHeight: 0.4,
		variance: 0.7,
		resourceDistribution: [
			[Rock, 0.2],
			[Tree, 0.2],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		texture: terrainTexture('forest'),
		appearHeight: 0.6,
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
		appearHeight: 0.8,
		variance: 1.5,
		resourceDistribution: [[Rock, 0.2]],
	},
}

const terrains = new TerrainDefinition<TexturedTerrain>(
	terrainTypes
	/*, waterTexture, {
	center: terrainTypes.snow,
	perimeter: terrainTypes.sand,
}*/
)
export default terrains
