import {
	type IVector3Like,
	type Mesh,
	MeshBuilder,
	type Scene,
	StandardMaterial,
	Vector3,
} from '@babylonjs/core'

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

/*
const assetsCache: Record<string, Promise<MeshCopy>> = {}

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()
export function meshAsset(url: string) {
	//const loader = url.endsWith('.fbx') ? fbxLoader : gltfLoader
	if (!assetsCache[url])
		assetsCache[url] = gltfLoader
			.loadAsync(url)
			// We use `z` as "up" while most models use `y`
			.then((gltf) => {
				gltf.scene.rotateX(Math.PI / 2).updateMatrixWorld()
				return gltf.scene
			})
			.then((obj) => new MeshCopy(obj))
	return new MeshPaste(assetsCache[url])
}
*/
