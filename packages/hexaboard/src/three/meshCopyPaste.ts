import { InstancedMesh, type Mesh, Object3D, Quaternion, type Scene } from 'three'

const generalMaxCount = 5000

interface GlobalPreRendered {
	prerender: (scene: Scene) => void
}
const globalPreRendered = new Set<GlobalPreRendered>()
export function prerenderGlobals(scene: Scene) {
	for (const g of globalPreRendered) g.prerender(scene)
}

function rootScene(obj3d: Object3D) {
	let browser = obj3d
	while (browser.parent) browser = browser.parent
	const scene = browser as Scene
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
let hasCount = 0
function recount(application: MeshCopySceneApplication) {
	const count = application.pastes.length
	if (count > hasCount) {
		hasCount = count
		//console.log('hasCount', count)
	}
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
		// Now updating on matrix update - killme
		/*const application = this.applications.get(scene)
		if (!application) return
		for (let i = 0; i < application.pastes.length; i++) {
			const paste = application.pastes[i]
			if (paste.matrixWorldNeedsUpdate) paste.updateMatrixWorld()
			forward(paste, i, application)
		}
		for (const instance of application.instances) instance.instanceMatrix.needsUpdate = true*/
	}
}

/**
 * Book keeping: MeshPaste should not be added to orphan objects and should always be linked in their tree to a scene
 */
export class MeshPaste extends Object3D {
	private scene: Scene | undefined
	private forwarding?: Promise<void>
	private readonly loading: Promise<MeshCopy>
	constructor(will: MeshCopy | Promise<MeshCopy>) {
		super()
		this.loading = Promise.resolve(will).then((copy) => {
			this.addEventListener('added', () => {
				if (this.scene) copy.unregister(this, this.scene)
				this.scene = rootScene(this)
				if (!this.scene) throw new Error('MeshPaste must be added to a scene')
				copy.register(this, this.scene)
			})
			this.addEventListener('removed', () => {
				if (this.scene) copy.unregister(this, this.scene)
				this.scene = undefined
			})
			this.scene = rootScene(this)
			if (this.scene) copy.register(this, this.scene)
			return copy
		})
	}
	updateWorldMatrix(): void {
		super.updateWorldMatrix
		if (!this.forwarding && this.scene)
			this.forwarding = this.loading.then((copy) => {
				if (this.scene) copy.updated(this.scene, this)
				this.forwarding = undefined
			})
	}
}
