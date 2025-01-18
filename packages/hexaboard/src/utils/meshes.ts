import {
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshBasicMaterial,
	type MeshBasicMaterialParameters,
	type Object3D,
	SphereGeometry,
	Vector3,
} from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// #region Common shapes
export function sphere(radius: number, params: MeshBasicMaterialParameters) {
	return new Mesh(new SphereGeometry(radius, 32, 32), new MeshBasicMaterial(params))
}

export function icosahedron(radius: number, params: MeshBasicMaterialParameters) {
	return new Mesh(new IcosahedronGeometry(radius), new MeshBasicMaterial(params))
}
// #endregion
/**
 * Retrieve a vertex of a mesh
 * @param mesh Mesh
 * @param index Vertex index
 */
export function meshVector3(mesh: Mesh, index: number): Vector3 {
	const p = mesh.geometry.attributes.position
	return new Vector3(p.getX(index), p.getY(index), p.getZ(index))
}

/**
 * Retrieve all vertices of a mesh
 * @param mesh Mesh
 */
export function* meshVectors3(mesh: Mesh): Generator<Vector3> {
	const p = mesh.geometry.attributes.position
	for (let i = 0; i < p.count; i++) yield new Vector3(p.getX(i), p.getY(i), p.getZ(i))
}

const assetsCache: Record<string, Promise<Object3D>> = {}

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()
export function meshAsset(url: string) {
	//const loader = url.endsWith('.fbx') ? fbxLoader : gltfLoader
	if (!assetsCache[url])
		assetsCache[url] = gltfLoader
			.loadAsync(url)
			.then((gltf) => gltf.scene)
			.then((obj) => {
				// We use `z` as "up" while most models use `y`
				obj.rotateX(Math.PI / 2)
				return obj
			})
	const rv = new Group()
	assetsCache[url].then((gltf) => {
		rv.add(gltf.clone())
	})
	//rv.scale.set(10, 10, 10)
	return rv
}
