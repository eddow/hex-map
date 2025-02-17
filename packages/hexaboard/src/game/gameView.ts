import {
	Color3,
	Color4,
	DirectionalLight,
	FreeCamera,
	HemisphericLight,
	type IVector2Like,
	Scene,
	type SceneOptions,
	Vector3,
	WebGPUEngine,
	type WebGPUEngineOptions,
} from '@babylonjs/core'
import { clamp } from '~/utils'
import type { Game } from './game'

export class GameView {
	public readonly camera: FreeCamera
	public readonly scene: Scene

	public game: Game = null!
	static async create(
		canvas: HTMLCanvasElement,
		engineOptions?: WebGPUEngineOptions,
		sceneOptions?: SceneOptions
	) {
		if (!navigator.gpu) {
			alert('❌ WebGPU not supported or disabled.')
			/*} else {
			const adapter = await navigator.gpu.requestAdapter({featureLevel: })
			if (!adapter) alert('❌ WebGPU adapter not found.')*/
		}
		try {
			return new GameView(
				canvas,
				await WebGPUEngine.CreateAsync(canvas, engineOptions),
				sceneOptions
			)
		} catch (e) {
			if (typeof e === 'string') alert(e)
			throw e
		}
	}
	private constructor(
		public readonly canvas: HTMLCanvasElement,
		public readonly engine: WebGPUEngine,
		sceneOptions?: SceneOptions
	) {
		const scene = new Scene(this.engine, sceneOptions)
		scene.clearColor = new Color4(0, 0, 0, 1)

		this.setLights()
		const camera = new FreeCamera('camera', new Vector3(300, 300, 300), scene)
		camera.detachControl()
		scene.detachControl()
		camera.setTarget(new Vector3(0, 0, 0))
		camera.minZ = 0.1
		camera.maxZ = 2000

		this.scene = scene
		this.camera = camera
		document.addEventListener('visibilitychange', this.visibilityChange)
		this.intersectionObserver = new IntersectionObserver(
			([entry]) => {
				this.isCanvasVisible = entry.isIntersecting
				this.updateRenderLoop()
			},
			{ threshold: 0.01 }
		)
		this.visibilityChange()
	}
	setLights() {
		const { scene } = this
		const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
		ambient.intensity = 0.5
		ambient.diffuse = new Color3(1, 1, 1)
		const directional = new DirectionalLight('light', new Vector3(0, -1, 0), scene)
		directional.position.set(0, 300, 0)
	}
	dispose() {
		this.engine.dispose()
		this.scene.dispose()
		document.removeEventListener('visibilitychange', this.visibilityChange)
		this.intersectionObserver.disconnect()
	}
	visibilityChange = () => {
		this.isPageVisible = !document.hidden
		this.updateRenderLoop()
	}
	private readonly intersectionObserver: IntersectionObserver
	isCanvasVisible = true
	isPageVisible = true
	isLoopActive = false
	updateRenderLoop() {
		const shouldRunRenderLoop = this.isCanvasVisible && this.isPageVisible
		if (shouldRunRenderLoop !== this.isLoopActive) {
			this.isLoopActive = shouldRunRenderLoop
			if (this.isLoopActive) this.engine.runRenderLoop(() => this.scene.render())
			else this.engine.stopRenderLoop()
		}
	}
	resize(width: number, height: number) {
		this.engine.resize()
	}

	private get cameraRightVector() {
		const { camera } = this
		// Extract the right vector (X-axis) from the camera's world matrix
		const matrix = camera.getWorldMatrix()
		const right = new Vector3(matrix.m[0], matrix.m[1], matrix.m[2])
		return right.normalize()
	}
	turn(delta: IVector2Like) {
		const { camera } = this
		// 🟢 1️⃣ Horizontal Rotation (Yaw)
		camera.rotation.y += delta.x * 0.01
		// 🟡 2️⃣ Vertical Rotation (Pitch)
		camera.rotation.x += delta.y * 0.01
		// 🟢 3️⃣ Clamp Vertical Tilt
		const maxTilt = Math.PI / 2 - 0.1 // Slightly less than 90° to prevent flipping
		camera.rotation.x = clamp(camera.rotation.x, 0, maxTilt)
	}

	pan(delta: IVector2Like) {
		// TODO add inertia or easing w/ mouse
		const { camera } = this
		const displacement = camera.position.y / 1000

		// 1️⃣ Get Right Vector (X-axis)
		const xv = Vector3.TransformNormal(new Vector3(1, 0, 0), camera.getWorldMatrix())
		// 2️⃣ Get Forward Vector (Z-axis projected from world up)
		const worldUpVector = Vector3.TransformNormal(new Vector3(0, 1, 0), camera.getWorldMatrix())
		// 3️⃣ Project Up Vector onto X-Z Plane
		const projectedUp = new Vector3(worldUpVector.x, 0, worldUpVector.z).normalize()
		// 4️⃣ Scale Projected Vector by Original Magnitude
		const originalMagnitude = worldUpVector.length()
		projectedUp.scaleInPlace(originalMagnitude)
		// 5️⃣ Pan Camera on X-Z Plane
		camera.position.addInPlace(xv.scale(-delta.x * displacement)) // Horizontal (X-axis)
		camera.position.addInPlace(projectedUp.scale(delta.y * displacement)) // Vertical (Z-axis)
	}

	zoom(center: Vector3, delta: number, clampCamY: { max: number; min: number }, zoomFactor = 1.2) {
		const { camera } = this
		// 1️⃣ Distance from center
		const dist = camera.position.clone().subtract(center)
		// 2️⃣ Apply zoom factor
		dist.scaleInPlace(zoomFactor ** delta)
		// 3️⃣ Move camera
		camera.position.copyFrom(center).addInPlace(dist)
		// 4️⃣ Clamp Z-axis
		camera.position.y = clamp(camera.position.y, clampCamY.min, clampCamY.max)
	}

	private oldPosition = new Vector3()
	public get updated() {
		if (!this.oldPosition.equals(this.camera.position)) {
			this.oldPosition.copyFrom(this.camera.position)
			return true
		}
		return false
	}
}
