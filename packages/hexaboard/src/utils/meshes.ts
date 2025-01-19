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
	return new Vector3().fromBufferAttribute(p, index)
}

/**
 * Retrieve all vertices of a mesh
 * @param mesh Mesh
 */
export function* meshVectors3(mesh: Mesh): Generator<Vector3> {
	const p = mesh.geometry.attributes.position
	for (let i = 0; i < p.count; i++) yield new Vector3().fromBufferAttribute(p, i)
}

//const assetsCache: Record<string, Promise<MeshCopy>> = {}
const assetsCache: Record<string, Promise<Object3D>> = {}

const gltfLoader = new GLTFLoader()
const fbxLoader = new FBXLoader()
export function meshAsset(url: string) {
	//const loader = url.endsWith('.fbx') ? fbxLoader : gltfLoader
	if (!assetsCache[url])
		assetsCache[url] = gltfLoader
			.loadAsync(url)
			// We use `z` as "up" while most models use `y`
			.then((gltf) => gltf.scene.rotateX(Math.PI / 2)) /*
			.then((obj) => new MeshCopy(obj)) /*
			.then((obj) => {
				let browser: Object3D = obj
				const g = new Group()
				g.add(obj)
				while (browser && !(browser as Mesh).isMesh) browser = browser.children[0]
				return new MeshCopy(obj)
			}) //*/
	//return new MeshPaste(assetsCache[url])
	const group = new Group()
	assetsCache[url].then((obj) => group.add(obj.clone()))
	return group
}
