import { InstancedMesh, type Mesh, Object3D, Quaternion, type Scene } from 'three'
import { assert } from '~/utils'

const generalMaxCount = 15000

interface GlobalPreRendered {
	prerender: (scene: Scene) => void
}
const globalPreRendered = new Set<GlobalPreRendered>()
export function prerenderGlobals(scene: Scene) {
	for (const g of globalPreRendered) g.prerender(scene)
}

function rootObj3d(obj3d: Object3D) {
	while (obj3d.parent) obj3d = obj3d.parent
	return obj3d
}

function rootScene(obj3d: Object3D) {
	const scene = rootObj3d(obj3d) as Scene
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
		cm.frustumCulled = false
		cm.count = 0
		rv = cm
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
let hasCount = 0
function recount(application: MeshCopySceneApplication) {
	const count = application.pastes.length
	if (count > hasCount) {
		//console.log('count', count)
		hasCount = count + 1
	}
	for (const instance of application.instances) instance.count = count
}
function forward(meshPaste: MeshPaste, index: number, application: MeshCopySceneApplication) {
	for (const instance of application.instances) {
		instance.setMatrixAt(index, meshPaste.matrixWorld)
		instance.instanceMatrix.needsUpdate = true
	}
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
		assert(this.applications.has(scene), 'Scene not registered')
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
		meshPaste.updateMatrixWorld(true)
		//forward(meshPaste, index, application)	// No need: this is called in `updateMatrixWorld`
	}
	updated(scene: Scene, meshPaste: MeshPaste) {
		const application = this.application(scene)
		const pastes = application?.pastes
		const index = pastes?.indexOf(meshPaste)

		assert(index !== -1 || (!index && index !== 0), 'MeshPaste not registered')
		forward(meshPaste, index, application)
	}
	unregister(meshPaste: MeshPaste, scene: Scene) {
		const application = this.application(scene)
		const pastes = application.pastes
		const index = pastes.indexOf(meshPaste)
		assert(index >= 0, 'MeshPaste not registered')
		const last = pastes.pop()!
		recount(application)
		// move the last instance to fill the freed gap
		if (index < pastes.length) {
			pastes[index] = last
			forward(last, index, application)
		}
	}
	prerender(scene: Scene) {
		// TODO: Now should be updating on matrix update - kill me when sure
		// Note: it's really tough to determine when to call the `forward`, even overriding `updateMatrixWorld` is not enough
		// cost: 18 ms/frame (1/4 of time allocated to render)
		/*
		const application = this.applications.get(scene)
		if (!application) return
		for (let i = 0; i < application.pastes.length; i++) {
			const paste = application.pastes[i]
			if (paste.matrixWorldNeedsUpdate) paste.updateMatrixWorld()
			forward(paste, i, application)
		}
		for (const instance of application.instances) {
			instance.instanceMatrix.needsUpdate = true
			instance.computeBoundingBox()
			instance.computeBoundingSphere()
		}*/
	}
}

let [added, removed] = [0, 0]

export class MeshPaste extends Object3D {
	private scene?: Scene
	private from?: MeshCopy
	constructor(will: MeshCopy | Promise<MeshCopy>) {
		super()
		const bindCopy = (copy: MeshCopy) => {
			this.from = copy
			this.scene = rootScene(this)
			added++
			if (this.scene) copy.register(this, this.scene)
		}
		if (will instanceof MeshCopy) bindCopy(will)
		else will.then(bindCopy)
		let parent = this.parent as RootKeeperObject3D | null
		if (parent) parent.onRootChange(this)
		this.addEventListener('added', () => {
			if (parent !== this.parent) {
				parent = this.parent as RootKeeperObject3D
				parent.onRootChange(this)
			}
		})
		this.addEventListener('removed', () => {
			parent!.offRootChange(this)
			parent = null
		})
	}
	changedRoot(root: Object3D) {
		const scene = (root as Scene).isScene ? (root as Scene) : undefined
		const copy = this.from
		if (copy && this.scene !== scene) {
			if (!this.scene && scene) added++
			if (this.scene && !scene) removed++
			//console.log('added', added, 'removed', removed)
			if (this.scene) copy.unregister(this, this.scene)
			this.scene = scene
			if (scene) copy.register(this, scene)
		}
	}
	updateMatrixWorld(force?: boolean): void {
		const needsUpdate = this.matrixWorldNeedsUpdate
		super.updateMatrixWorld(force)
		if (this.from && this.scene && (needsUpdate || force)) this.from.updated(this.scene, this)
	}
}

interface RootKeeperObject3D extends Object3D {
	rootListeners?: RootKeeperObject3D[]
	parent: RootKeeperObject3D | null
	changedRoot(root: Object3D): void
	onRootChange(child: Object3D): void
	offRootChange(child: Object3D): void
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
		add(this: RootKeeperObject3D, ...children: RootKeeperObject3D[]) {
			const root = rootObj3d(this)
			for (const child of children) {
				original.add.call(this, child)
				if (child.rootListeners) {
					child.changedRoot(root)
					this.onRootChange(child)
				}
			}
		},
		remove(this: RootKeeperObject3D, ...children: RootKeeperObject3D[]) {
			for (const child of children) {
				original.remove.call(this, child)
				if (child.rootListeners) {
					child.changedRoot(child)
					this.offRootChange(child)
				}
			}
		},
		changedRoot(this: RootKeeperObject3D, root: RootKeeperObject3D) {
			if (!this.rootListeners) return
			for (const listener of this.rootListeners) listener.changedRoot(root)
		},
		onRootChange(this: RootKeeperObject3D, child: RootKeeperObject3D) {
			this.rootListeners ??= []
			this.rootListeners.push(child)
			if (this.rootListeners.length === 1) this.parent?.onRootChange(this)
		},
		offRootChange(this: RootKeeperObject3D, child: RootKeeperObject3D) {
			if (!this.rootListeners) return
			const index = this.rootListeners.indexOf(child)
			if (index === -1) return
			this.rootListeners.splice(index, 1)
			if (this.rootListeners.length === 0) {
				this.rootListeners = undefined
				this.parent?.offRootChange(this)
			}
		},
	})
}
patchObject3D()
