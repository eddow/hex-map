import type { RandGenerator } from '~/utils/random'
import { type ResourceDistribution, Rock, Tree } from './handelable'

export const wholeScale = 80
export type Terrain = keyof typeof terrainTypes
export interface TerrainType {
	color: { r: number; g: number; b: number }
	appearHeight: number
	variance: number
	resourceDistribution: ResourceDistribution
}
const many = (gen: RandGenerator) => gen(4, 1)
const few = (gen: RandGenerator) => gen() * 2 - 1

export const terrainTypes: Record<string, TerrainType> = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		appearHeight: Number.NEGATIVE_INFINITY,
		variance: 0.1,
		resourceDistribution: [[Rock, 0.05]],
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		appearHeight: 0.2,
		variance: 0.7,
		resourceDistribution: [
			[Rock, 0.05],
			[Tree, 0.05],
		],
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		appearHeight: 0.5,
		variance: 2,
		resourceDistribution: [
			[Rock, 0.05],
			[Tree, 0.2],
		],
	},
	stone: {
		color: { r: 0.6, g: 0.4, b: 0.1 },
		appearHeight: 0.7,
		variance: 3,
		resourceDistribution: [
			[Rock, 0.2],
			[Tree, 0.05],
		],
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		appearHeight: 0.9,
		variance: 1.5,
		resourceDistribution: [[Rock, 0.05]],
	},
}

export function terrainType(height: number): Terrain {
	let rvH: number | undefined
	let rvT: undefined | Terrain
	for (const type in terrainTypes) {
		const thisH = terrainTypes[type as Terrain].appearHeight
		if (height / wholeScale >= thisH && (rvH === undefined || thisH > rvH)) {
			rvH = thisH
			rvT = type as Terrain
		}
	}
	return rvT!
}
