import type { Mesh } from 'three'
import { sphere } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/random'

export interface Artefact {
	type: string
	mesh: Mesh
}
export type ArtefactGenerator = (gen: RandGenerator) => Artefact

export function* generateArtifacts(n: number, artefact: ArtefactGenerator, gen: RandGenerator) {
	for (let i = 0; i < n; i++) yield artefact(gen)
}

export function tree(gen: RandGenerator) {
	return { type: 'tree', mesh: sphere(gen(3, 1), { color: 0x00f000 }) }
}

export function rock(gen: RandGenerator) {
	return { type: 'rock', mesh: sphere(gen(2, 0.5), { color: 0x808080 }) }
}
