import type { Object3D } from 'three'
import type { TerrainBase, TileContent } from '~/ground'
import { meshAsset } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/numbers'

/**
 * Any thing that can be placed on the map and interacted with by the characters (resources, trees, rocks, artifacts, etc.)
 */
export abstract class Handelable implements TileContent {
	protected cachedMesh?: Object3D
	abstract createMesh(): Object3D
	walkTimeMultiplier = 1.3
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

interface HandelableAllure {
	model: number
	rotation: number
}

export type ResourceDistribution = [typeof Resource, number]
export interface ResourcefulTerrain extends TerrainBase {
	resourceDistribution: ResourceDistribution[]
}
export class Resource<Terrain extends ResourcefulTerrain = ResourcefulTerrain> extends Handelable {
	walkTimeMultiplier = 1.7
	allure: HandelableAllure
	constructor(allure: HandelableAllure)
	constructor(gen: RandGenerator, terrain: Terrain)
	constructor(allure: HandelableAllure | RandGenerator, terrain?: Terrain) {
		super()
		this.allure =
			typeof allure === 'function' ? this.generate(allure as RandGenerator, terrain!) : allure
	}
	generate(gen: RandGenerator, terrain: Terrain): HandelableAllure {
		return { model: Math.floor(gen(this.nbrModels)) + 1, rotation: gen(Math.PI * 2) }
	}
	get path(): string {
		throw new Error('Not implemented')
	}
	get nbrModels(): number {
		throw new Error('Not implemented')
	}
	createMesh() {
		const mesh = meshAsset(this.path.replace('#', this.allure.model.toString())) as Object3D
		mesh.rotateZ(this.allure.rotation)
		return mesh
	}
}

// Supplies -> wood, hammer, meat
