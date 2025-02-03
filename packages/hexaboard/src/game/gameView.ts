import {
	PerspectiveCamera,
	type Vector2Like,
	Vector3,
	type Vector3Like,
	WebGLRenderer,
} from 'three'
import type { InputInteraction } from '~/input/inputInteraction'
import type { Game } from './game'

export class GameView {
	public readonly camera
	private readonly renderer
	constructor(
		public readonly game: Game,
		canvas?: HTMLCanvasElement,
		private readonly interaction?: InputInteraction,
		{ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 1000 }
	) {
		this.camera = new PerspectiveCamera(75, 1, near, far)
		this.renderer = new WebGLRenderer({ canvas, antialias: true })
		interaction?.listenTo(this.renderer.domElement)
	}
	dispose() {
		this.interaction?.unListenTo(this.renderer.domElement)
		this.renderer.dispose()
	}
	get canvas() {
		return this.renderer.domElement
	}
	resize(width: number, height: number) {
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(width, height)
	}
	render() {
		// Don't rely on the `dispose` mechanism to stop rendering on a canvas when they are removed
		const canvas = this.renderer.domElement
		if (!document.body.contains(canvas) || canvas.offsetWidth === 0 || canvas.offsetHeight === 0)
			return
		const style = window.getComputedStyle(canvas)
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return
		this.renderer.render(this.game.scene, this.camera)
	}
	turn(delta: Vector2Like) {
		const { camera } = this
		// Rotate camera
		// x: movement rotates the camera around the word's Z axis
		camera.rotateOnWorldAxis(new Vector3(0, 0, -1), delta.x * 0.01)
		// y: camera tilts between horizontal (plan: z=0) and vertical (look along Z axis) positions
		camera.rotateX(-delta.y * 0.01) // Apply tilt rotation
		// clamp down/horizon
		const upVector = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
		if (upVector.z < 0) camera.rotateX(-Math.asin(upVector.z))
		const frontVector = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion)
		// clamp to "nearly horizontal"
		if (frontVector.z < 0.1) camera.rotateX(Math.asin(frontVector.z - 0.1))
	}
	pan(delta: Vector2Like) {
		const { camera } = this
		const displacement = camera.position.z / 1000
		const xv = new Vector3(1, 0, 0)
		xv.applyQuaternion(camera.quaternion)
		const upVector = new Vector3(0, 1, 0)
		const worldUpVector = upVector.applyQuaternion(camera.quaternion)

		const projectedUp = new Vector3(worldUpVector.x, worldUpVector.y, 0)

		// Step 3: Normalize the vector
		projectedUp.normalize()

		// Step 4: Scale it to match the original magnitude
		const originalMagnitude = worldUpVector.length()
		projectedUp.multiplyScalar(originalMagnitude)
		// Pan camera
		camera.position
			.add(xv.multiplyScalar(-delta.x * displacement))
			.add(projectedUp.multiplyScalar(delta.y * displacement))
	}
	zoom(
		center: Vector3Like,
		delta: number,
		clampCamZ: { max: number; min: number },
		zoomFactor = 1.2
	) {
		const { camera } = this
		const dist = camera.position.clone().sub(center)
		dist.multiplyScalar(zoomFactor ** delta)
		camera.position.copy(center).add(dist)
		camera.position.z = Math.max(Math.min(camera.position.z, clampCamZ.max), clampCamZ.min)
	}
}
