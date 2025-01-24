import {
	InstancedMesh,
	type Mesh,
	Object3D,
	type Object3DEventMap,
	Quaternion,
	type Scene,
} from 'three'

const generalMaxCount = 5000

interface GlobalPreRendered {
	prerender: (scene: Scene) => void
}
const globalPreRendered = new Set<GlobalPreRendered>()
export function prerenderGlobals(scene: Scene) {
	for (const g of globalPreRendered) g.prerender(scene)
}

function rootScene(obj3d: Object3D) {
	while (obj3d.parent) obj3d = obj3d.parent
	const scene = obj3d as Scene
	return scene.isScene ? scene : undefined
}

function obj3dToInstancedMeshes(obj3d: Object3D, maxCount: number) {
	if ((obj3d as InstancedMesh).isInstancedMesh) throw new Error('`InstancedMesh` cannot be copied')
	const mesh = obj3d as Mesh
	let rv = obj3d
	if (mesh.isMesh) {
		mesh.updateMatrixWorld()
		const cm = new InstancedMesh(
			mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
			mesh.material,
			maxCount
		)
		cm.count = 0
		rv = cm
		cm.frustumCulled = false
	}
	const recursion = [...obj3d.children]
	for (const child of recursion) {
		const transformed = obj3dToInstancedMeshes(child, maxCount)
		if (transformed !== child) {
			obj3d.remove(child)
			rv.add(transformed)
		}
	}
	rv.position.setScalar(0)
	rv.rotation.setFromQuaternion(new Quaternion())
	rv.scale.setScalar(1)
	rv.updateMatrix()
	return rv
}

function gatherIMs(obj3d: Object3D) {
	const rv: InstancedMesh[] = []
	obj3d.traverse((child) => {
		if ((child as InstancedMesh).isInstancedMesh) rv.push(child as InstancedMesh)
	})
	return rv
}
function recount(application: MeshCopySceneApplication) {
	const count = application.pastes.length
	for (const instance of application.instances) instance.count = count
}
function forward(meshPaste: MeshPaste, index: number, application: MeshCopySceneApplication) {
	for (const instance of application.instances) instance.setMatrixAt(index, meshPaste.matrixWorld)
}

type MeshCopySceneApplication = {
	object3d: Object3D
	pastes: MeshPaste[]
	instances: InstancedMesh[]
}
/**
 * Give this guy a mesh, and it will paste it as many times as you wish without a cost
 * @see https://threejs.org/docs/#api/en/objects/InstancedMesh
 */
export class MeshCopy implements GlobalPreRendered {
	private object3d: Object3D
	private readonly applications = new WeakMap<Scene, MeshCopySceneApplication>()
	constructor(object3d: Object3D, maxCount: number = generalMaxCount) {
		const clone = object3d.clone()
		this.object3d = obj3dToInstancedMeshes(clone, maxCount) || clone
		globalPreRendered.add(this)
		//? dispose => globalPreRendered.delete
	}
	application(scene: Scene) {
		if (!this.applications.has(scene)) throw new Error('Inconsistency: Scene not registered')
		return this.applications.get(scene)!
	}
	register(meshPaste: MeshPaste, scene: Scene) {
		if (!this.applications.has(scene)) {
			const object3d = this.object3d.clone()
			this.applications.set(scene, {
				object3d,
				instances: gatherIMs(object3d),
				pastes: [],
			})
			scene.add(object3d)
		}
		const application = this.application(scene)
		const index = application.pastes.length
		application.pastes.push(meshPaste)
		recount(application)
		forward(meshPaste, index, application)
	}
	updated(scene: Scene, meshPaste: MeshPaste) {
		const application = this.application(scene)
		const pastes = application?.pastes
		const index = pastes?.indexOf(meshPaste)
		if (index === -1 || (!index && index !== 0))
			throw new Error('Inconsistency: MeshPaste not registered')
		forward(meshPaste, index, application)
	}
	unregister(meshPaste: MeshPaste, scene: Scene) {
		const application = this.application(scene)
		const pastes = application.pastes
		const index = pastes.indexOf(meshPaste)
		if (index < 0) throw new Error('Inconsistency: MeshPaste not registered')
		const last = pastes.pop()!
		recount(application)
		// move the last instance to fill the freed gap
		if (index < pastes.length) {
			pastes[index] = last
			forward(last, index, application)
		}
	}
	prerender(scene: Scene) {
		// Now updating on matrix update - kill me when sure
		// Note: it's really tough to determine when to call the `forward`, even overriding `updateMatrixWorld` is not enough
		// cost: 1.23 ms/frame
		const application = this.applications.get(scene)
		if (!application) return
		for (let i = 0; i < application.pastes.length; i++) {
			const paste = application.pastes[i]
			if (paste.matrixWorldNeedsUpdate) paste.updateMatrixWorld()
			forward(paste, i, application)
		}
		for (const instance of application.instances) instance.instanceMatrix.needsUpdate = true
	}
}

export class MeshPaste extends Object3D<Object3DTreeEventMap> {
	private scene: Scene | undefined
	constructor(will: MeshCopy | Promise<MeshCopy>) {
		super()
		Promise.resolve(will).then((copy) => {
			this.addEventListener('changedScene', ({ scene }) => {
				if (this.scene && this.scene !== scene) copy.unregister(this, this.scene)
				this.scene = scene
				if (scene) copy.register(this, scene)
			})
			// Usually, `changedScene` was not called as `addEventListener` was called after the add (Promise stuff)
			this.scene = rootScene(this)
			if (this.scene) copy.register(this, this.scene)
			return copy
		})
	}
	/*
	private forwarding?: Promise<void> = Promise.resolve(will).then...
	private readonly loading: Promise<MeshCopy>
	updateWorldMatrix(): void {
		super.updateWorldMatrix
		if (!this.forwarding && this.scene)
			this.forwarding = this.loading.then((copy) => {
				if (this.scene) copy.updated(this.scene, this)
				this.forwarding = undefined
			})
	}
	*/
}

export interface Object3DTreeEventMap extends Object3DEventMap {
	changedScene: { scene?: Scene }
}

/**
 * Patch Object3D
 */
function patchObject3D() {
	const prototype = Object3D.prototype
	const original = {
		add: prototype.add,
		remove: prototype.remove,
	}
	Object.assign(prototype, {
		add(this: Object3D, ...children: Object3D[]) {
			const scene = rootScene(this)
			for (const child of children) {
				if (scene && rootScene(child) !== scene)
					child.traverse((sub) =>
						(sub as Object3D<Object3DTreeEventMap>).dispatchEvent({ type: 'changedScene', scene })
					)
				original.add.call(this, child)
			}
		},
		remove(this: Object3D, ...children: Object3D[]) {
			for (const child of children) {
				if (this.children.includes(child) && rootScene(child))
					child.traverse((sub) =>
						(sub as Object3D<Object3DTreeEventMap>).dispatchEvent({ type: 'changedScene' })
					)
				original.remove.call(this, child)
			}
		},
	})
}
patchObject3D()
