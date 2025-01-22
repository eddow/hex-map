import type { TerrainType } from 'dist/src/game'
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
		return { model: Math.floor(gen(this.nbrModels)) + 1, rotation: gen(Math.PI * 2) }
	}
	abstract get path(): string
	abstract get nbrModels(): number
	createMesh() {
		const mesh = meshAsset(
			this.path.replace('#', this.characteristics.model.toString())
		) as Object3D
		//mesh.rotateZ(this.characteristics.rotation)
		return mesh
	}
}

interface ResourcefulTerrain extends TerrainBase {
	resourceDistribution: ResourceDistribution[]
}

export type ResourceGenerator = new (gen: RandGenerator, terrain: ResourcefulTerrain) => Resource
export type ResourceDistribution = [ResourceGenerator, number][]
export function generateResource(gen: RandGenerator, terrain: ResourcefulTerrain) {
	const resources = terrain.resourceDistribution
	const repeat = hexTiles(terrainContentRadius + 1)
	if (!resources.length) return /* TODO
		let choice = gen()
		for (let [resource, chance] of resources) {
			chance /= repeat
			if (choice < chance) return new resource(gen, terrain)
			choice -= chance
		}
		*/
}
export function* generateResources(gen: RandGenerator, terrain: ResourcefulTerrain, n: number) {
	for (let i = 0; i < n; i++) yield generateResource(gen, terrain)
}

// Supplies -> wood, hammer, meat

/*
	meshContent() {
		for (let hexIndex = 0; hexIndex < this.nbrTiles; hexIndex++) {
			const p = this.points[hexIndex]
			if (p.content.length) {
				if (!p.group) {
					p.group = new Group()
					p.group.position.copy(this.vPosition(hexIndex))
					this.group.add(p.group)
				}
				for (let i = 0; i < p.content.length; i++)
					if (p.content[i]) {
						const pos = this.cartesian(hexIndex, posInTile(i, terrainContentRadius))
						// Pos is null when no neighbor sector is present and the resource is out of rendering zone on the border
						if (pos) {
							const rsc = p.content[i]!
							if (!rsc.builtMesh) {
								const mesh = rsc.createMesh()
								mesh.position.copy(pos)
								p.group.add(mesh)
							}
						}
					}
			}
		}
	}
	populatePoint(p: TexturedTile, position: Axial, hexIndex: number): void {
		const gen = LCG(p.seed + 0.2)
		if (p.z > 0)
			p.content = Array.from(generateResources(gen, p.type, hexTiles(terrainContentRadius + 1)))
	}
	
	
	
	
	
	
	
	
	
*/
