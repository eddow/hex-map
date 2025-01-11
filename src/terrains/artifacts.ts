import { Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
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
	const sphereGeometry = new SphereGeometry(gen(3, 1), 8, 8)
	const sphereMaterial = new MeshBasicMaterial({
		color: 0x00f000,
	})
	return { type: 'tree', mesh: new Mesh(sphereGeometry, sphereMaterial) }
}

export function rock(gen: RandGenerator) {
	const sphereGeometry = new SphereGeometry(gen(3, 1), 8, 8)
	const sphereMaterial = new MeshBasicMaterial({
		color: 0x808080,
	})
	return { type: 'rock', mesh: new Mesh(sphereGeometry, sphereMaterial) }
}
