import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import type { RandGenerator } from '~/utils/random'
import { type Artefact, generateArtifacts, rock, tree } from './artifacts'
const { floor } = Math
export const wholeScale = 80
export type Terrain = keyof typeof terrainTypes
export interface TerrainType {
	color: { r: number; g: number; b: number }
	minHeight: number
	variance: number
	artifacts(gen: RandGenerator): void
}
export const terrainTypes = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		minHeight: Number.NEGATIVE_INFINITY,
		variance: 0.1,
		*artifacts(gen: RandGenerator) {
			yield* generateArtifacts(gen() * 2 - 1, rock, gen)
		},
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		minHeight: 10,
		variance: 0.7,
		*artifacts(gen: RandGenerator) {
			yield* generateArtifacts(gen() * 2 - 1, tree, gen)
			yield* generateArtifacts(gen() * 2 - 1, rock, gen)
		},
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		minHeight: 30,
		variance: 2,
		*artifacts(gen: RandGenerator) {
			yield* generateArtifacts(gen(4, 1), tree, gen)
			yield* generateArtifacts(gen() * 2 - 1, rock, gen)
		},
	},
	stone: {
		color: { r: 0.2, g: 0.2, b: 0.2 },
		minHeight: 45,
		variance: 3,
		*artifacts(gen: RandGenerator) {
			yield* generateArtifacts(gen() * 2 - 1, tree, gen)
			yield* generateArtifacts(gen(4, 1), rock, gen)
		},
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		minHeight: 55,
		variance: 1.5,
		*artifacts(gen: RandGenerator) {
			yield* generateArtifacts(gen() * 2 - 1, rock, gen)
		},
	},
}

export function terrainType(height: number): Terrain {
	let rvH: number | undefined
	let rvT: undefined | Terrain
	for (const type in terrainTypes) {
		const thisH = terrainTypes[type as Terrain].minHeight
		if (height >= thisH && (rvH === undefined || thisH > rvH)) {
			rvH = thisH
			rvT = type as Terrain
		}
	}
	return rvT!
}
