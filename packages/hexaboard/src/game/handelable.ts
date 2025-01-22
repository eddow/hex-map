import type { Object3D } from 'three'
import type { TerrainBase } from '~/ground/terrain'
import { hexTiles } from '~/utils/axial'
import { meshAsset } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/numbers'

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
export class Resource extends Handelable {
	characteristics: Characteristics
	constructor(characteristics: Characteristics)
	constructor(gen: RandGenerator, terrain: ResourcefulTerrain)
	constructor(characteristics: Characteristics | RandGenerator, terrainType?: ResourcefulTerrain) {
		super()
		this.characteristics =
			typeof characteristics === 'function'
				? this.generate(characteristics as RandGenerator, terrainType!)
				: characteristics
	}
	generate(gen: RandGenerator, terrain: ResourcefulTerrain): Characteristics {
		return { model: Math.floor(gen(this.nbrModels)) + 1, rotation: gen(Math.PI * 2) }
	}
	get path(): string {
		throw new Error('Not implemented')
	}
	get nbrModels(): number {
		throw new Error('Not implemented')
	}
	createMesh() {
		const mesh = meshAsset(
			this.path.replace('#', this.characteristics.model.toString())
		) as Object3D
		//mesh.rotateZ(this.characteristics.rotation)
		return mesh
	}
}

export interface ResourcefulTerrain extends TerrainBase {
	resourceDistribution: ResourceDistribution[]
}

export type ResourceGenerator = new (gen: RandGenerator, terrain: ResourcefulTerrain) => Resource
export type ResourceDistribution = [typeof Resource, number]
export function generateResource(gen: RandGenerator, terrain: ResourcefulTerrain) {
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
export function* generateResources(gen: RandGenerator, terrain: ResourcefulTerrain, n: number) {
	for (let i = 0; i < n; i++) yield generateResource(gen, terrain)
}

// Supplies -> wood, hammer, meat
