import { type BufferGeometry, type IUniform, Mesh, type ShaderMaterial } from 'three'

/**
 * Shared shader material
 * Allows to share to share a shader while only changing the `uniforms` for each mesh
 * @see https://threejs.org/docs/#api/en/materials/ShaderMaterial - Custom attributes and uniforms
 * History: when the land was a bunch of triangle mesh...
 * Unused, but could still be useful
 */
export class SharedShaderMaterial {
	private meshUniforms = new WeakMap<Mesh, Record<string, IUniform>>()
	constructor(private readonly material: ShaderMaterial) {
		this.material.onBeforeRender = (renderer, scene, camera, geometry, mesh: Mesh) => {
			const meshUniforms = this.meshUniforms.get(mesh)
			if (!meshUniforms) throw new Error('Mesh uniforms not found')
			Object.assign(material.uniforms, meshUniforms)
			material.uniformsNeedUpdate = true
			material.needsUpdate = true
		}
	}
	/**
	 * Equivalent of "new Mesh(geometry, this.material[`withUniforms: ${uniforms}`])"
	 * @param geometry Geometry of the mesh to create
	 * @param uniforms Uniform values to use for this particular mesh
	 * @returns
	 */
	createMesh(geometry: BufferGeometry, uniforms: Record<string, unknown>) {
		const mesh = new Mesh(geometry, this.material)
		const valued = Object.fromEntries(Object.entries(uniforms).map(([k, v]) => [k, { value: v }]))
		this.meshUniforms.set(mesh, valued)
		return mesh
	}
}
