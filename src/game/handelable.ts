import type { Mesh, Object3D } from 'three'
import { hexTiles } from '~/hexagon/utils'
import { meshAsset, sphere } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/random'
import type { TerrainType } from './terrain'

/**
 * Number of hexagonal "circles" around the center of sub-tiles that can contain something
 */
export const terrainContentRadius = 1

/**
 * Any thing that can be placed on the map and interacted with by the characters (resources, trees, rocks, artifacts, etc.)
 */
export abstract class Handelable {
	protected cachedMesh?: Object3D
	abstract createMesh(): Object3D
	protected invalidateMesh() {
		this.cachedMesh = undefined
	}
	get mesh() {
		if (!this.cachedMesh) this.cachedMesh = this.createMesh()
		return this.cachedMesh
	}
	get builtMesh() {
		return !!this.cachedMesh
	}
}

interface Characteristics {
	model: number
	rotation: number
}
export abstract class Resource extends Handelable {
	characteristics: Characteristics
	constructor(characteristics: Characteristics)
	constructor(gen: RandGenerator, terrain: TerrainType)
	constructor(characteristics: Characteristics | RandGenerator, terrainType?: TerrainType) {
		super()
		this.characteristics =
			typeof characteristics === 'function'
				? this.generate(characteristics as RandGenerator, terrainType!)
				: characteristics
	}
	generate(gen: RandGenerator, terrain: TerrainType): Characteristics {
		return { model: Math.floor(gen(this.models)) + 1, rotation: gen(Math.PI * 2) }
	}
	abstract get path(): string
	abstract get models(): number
	createMesh() {
		const mesh = meshAsset(
			this.path.replace('#', this.characteristics.model.toString())
		) as Object3D
		mesh.rotateZ(this.characteristics.rotation)
		return mesh
	}
}

export class Tree extends Resource {
	get models() {
		return 3
	}
	get path() {
		return '/assets/resource/tree#.glb'
	}
}

export class Rock extends Resource {
	get models() {
		return 3
	}
	get path() {
		return '/assets/resource/rock#.glb'
	}
}

export type ResourceGenerator = new (gen: RandGenerator, terrain: TerrainType) => Resource
export type ResourceDistribution = [ResourceGenerator, number][]
export function generateResource(gen: RandGenerator, terrain: TerrainType) {
	const resources = terrain.resourceDistribution
	const repeat = hexTiles(terrainContentRadius + 1)
	if (!resources.length) return
	let choice = gen()
	for (let [resource, chance] of resources) {
		chance /= repeat
		if (choice < chance) return new resource(gen, terrain)
		choice -= chance
	}
}
export function* generateResources(gen: RandGenerator, terrain: TerrainType, n: number) {
	for (let i = 0; i < n; i++) yield generateResource(gen, terrain)
}

// Supplies -> wood, hammer, meat
