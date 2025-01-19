import { InstancedMesh, type Mesh, Object3D, type Scene } from 'three'

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

function toInstanced(mesh: Mesh, maxCount: number) {
	mesh.updateMatrixWorld()
	return new InstancedMesh(
		mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
		mesh.material,
		maxCount
	)
}
//let hasCount = 0
function recount(application: MeshCopySceneApplication) {
	//if (count > hasCount) hasCount = count
	application.iMesh.count = application.pastes.length
}
function forward(meshPaste: MeshPaste, index: number, application: MeshCopySceneApplication) {
	application.iMesh.setMatrixAt(index, meshPaste.matrixWorld)
}

type MeshCopySceneApplication = {
	iMesh: InstancedMesh
	pastes: MeshPaste[]
}
/**
 * Give this guy a mesh, and it will paste it as many times as you wish without a cost
 * @see https://threejs.org/docs/#api/en/objects/InstancedMesh
 */
export class MeshCopy implements GlobalPreRendered {
	private mesh: InstancedMesh
	private readonly applications = new WeakMap<Scene, MeshCopySceneApplication>()
	constructor(mesh: Mesh, maxCount: number = generalMaxCount) {
		const clone = mesh.clone()
		this.mesh = toInstanced(clone, maxCount) || clone
		globalPreRendered.add(this)
		//? dispose => globalPreRendered.delete
	}
	application(scene: Scene) {
		if (!this.applications.has(scene)) throw new Error('Inconsistency: Scene not registered')
		return this.applications.get(scene)!
	}
	register(meshPaste: MeshPaste, scene: Scene) {
		if (!this.applications.has(scene)) {
			const mesh = this.mesh.clone()
			this.applications.set(scene, {
				iMesh: mesh,
				pastes: [],
			})
			scene.add(mesh)
		}
		const application = this.application(scene)
		//const index = application.pastes.length
		application.pastes.push(meshPaste)
		recount(application)
		//if (!meshPaste.matrixWorldNeedsUpdate) forward(meshPaste, index, application)
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
			//if (!last.matrixWorldNeedsUpdate) forward(last, index, application)
		}
	}
	prerender(scene: Scene) {
		const application = this.applications.get(scene)
		if (!application) return
		for (let i = 0; i < application.pastes.length; i++) {
			const paste = application.pastes[i]
			if (paste.matrixWorldNeedsUpdate) paste.updateMatrixWorld()
			forward(paste, i, application)
		}
		application.iMesh.instanceMatrix.needsUpdate = true
	}
}

/**
 * Book keeping: MeshPaste should not be added to orphan objects and should always be linked in their tree to a scene
 */
export class MeshPaste extends Object3D {
	private scene: Scene | undefined
	constructor(will: MeshCopy | Promise<MeshCopy>) {
		super()
		Promise.resolve(will).then((copy) => {
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
		})
	}
}
