import type { Object3D } from 'three'
import type { ResourceDistribution, TerrainBase } from '~/sectored'
import { meshAsset } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/numbers'

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

interface HandelableAllure {
	model: number
	rotation: number
}

export interface ResourcefulTerrain extends TerrainBase {
	resourceDistribution: ResourceDistribution[]
}
export class Resource extends Handelable {
	allure: HandelableAllure
	constructor(allure: HandelableAllure)
	constructor(gen: RandGenerator, terrain: ResourcefulTerrain)
	constructor(allure: HandelableAllure | RandGenerator, terrainType?: ResourcefulTerrain) {
		super()
		this.allure =
			typeof allure === 'function' ? this.generate(allure as RandGenerator, terrainType!) : allure
	}
	generate(gen: RandGenerator, terrain: ResourcefulTerrain): HandelableAllure {
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
		//mesh.rotateZ(this.characteristics.rotation)
		return mesh
	}
}

// Supplies -> wood, hammer, meat
