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
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export function sphere(radius: number, params: MeshBasicMaterialParameters) {
	return new Mesh(new SphereGeometry(radius, 32, 32), new MeshBasicMaterial(params))
}

export function icosahedron(radius: number, params: MeshBasicMaterialParameters) {
	return new Mesh(new IcosahedronGeometry(radius), new MeshBasicMaterial(params))
}

export function meshVector3(mesh: Mesh, index: number): Vector3 {
	const p = mesh.geometry.attributes.position
	return new Vector3(p.getX(index), p.getY(index), p.getZ(index))
}

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
