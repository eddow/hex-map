import {
	type IVector3Like,
	type Mesh,
	MeshBuilder,
	type Scene,
	StandardMaterial,
	Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders'

export function vector3from(position: IVector3Like) {
	return new Vector3(position.x, position.y, position.z)
}

export function vector3position(position: Vector3) {
	return { x: position.x, y: position.y, z: position.z }
}

export class MeshUtils {
	constructor(private scene: Scene) {}

	private materialized(mesh: Mesh, params?: Partial<StandardMaterial>) {
		const { scene } = this
		const material = new StandardMaterial(`${mesh.name}-material`, scene)
		if (params) Object.assign(material, params)
		mesh.material = material
		return mesh
	}
	// #region Common shapes
	sphere(name: string, radius: number, params?: Partial<StandardMaterial>): Mesh {
		const { scene } = this

		return this.materialized(
			MeshBuilder.CreateSphere(
				name,
				{
					diameter: radius * 2,
					segments: 32,
				},
				scene
			),
			params
		)
	}

	icosahedron(name: string, radius: number, params?: Partial<StandardMaterial>): Mesh {
		const { scene } = this

		return this.materialized(
			MeshBuilder.CreatePolyhedron(name, { type: 3, size: radius }, scene),
			params
		)
	}
}
