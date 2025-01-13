import type { Mesh } from 'three'
import { genTilePosition } from '~/hexagon/utils'
import { sphere } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/random'
import { type TerrainType, terrainType } from './terrain'
/*
export interface ArtefactType {
	generate(gen: RandGenerator, terrain: TerrainType): Partial<Artefact>
	mesh(artefact: Artefact): Mesh
}

export interface Artefact {
	type: () => ArtefactType
	pos: { u: number; v: number; s: number }
	mesh?: Mesh
}

export interface SizedArtefact extends Artefact {
	size: number
}

export function* generateArtifacts(
	n: number,
	type: ArtefactType,
	gen: RandGenerator,
	terrain: TerrainType
) {
	for (let i = 0; i < n; i++) yield generateArtefact(type, gen, terrain)
}

function generateArtefact(type: ArtefactType, gen: RandGenerator, terrain: TerrainType) {
	return {
		type,
		pos: genTilePosition(gen),
		...type.generate(gen, terrain),
	}
}

export const tree = {
	generate: (gen: RandGenerator) => ({ size: gen(3, 1) }),
	mesh: (artefact: SizedArtefact) => sphere(artefact.size, { color: 0x00f000 }),
}
export const rock = {
	generate: (gen: RandGenerator) => ({ size: gen(2, 0.5) }),
	mesh: (artefact: SizedArtefact) => sphere(artefact.size, { color: 0x808080 }),
}

*/
/**
 * Any thing that can be placed on the map and interacted with by the characters (resources, trees, rocks, artifacts, etc.)
 */
export abstract class Handelable {
	protected cachedMesh?: Mesh
	abstract createMesh(): Mesh
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
	size: number
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
	abstract generate(gen: RandGenerator, terrain: TerrainType): Characteristics
	abstract get color(): number
	createMesh() {
		return sphere(this.characteristics.size, { color: this.color })
	}
}

export class Tree extends Resource {
	get color() {
		return 0x00f000
	}
	generate(gen: RandGenerator) {
		return { size: gen(3, 1) }
	}
}

export class Rock extends Resource {
	get color() {
		return 0x808080
	}
	generate(gen: RandGenerator) {
		return { size: gen(2, 0.5) }
	}
}

export type ResourceGenerator = new (gen: RandGenerator, terrain: TerrainType) => Resource
export type ResourceDistribution = [ResourceGenerator, number][]
export function generateResource(gen: RandGenerator, terrain: TerrainType) {
	const resources = terrain.resourceDistribution
	if (!resources.length) return
	let choice = gen()
	for (const [resource, chance] of resources) {
		if (choice < chance) return new resource(gen, terrain)
		choice -= chance
	}
}
export function* generateResources(gen: RandGenerator, terrain: TerrainType, n: number) {
	for (let i = 0; i < n; i++) yield generateResource(gen, terrain)
}
