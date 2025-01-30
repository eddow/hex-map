import {
	AmbientLight,
	Clock,
	DirectionalLight,
	Group,
	type Object3D,
	PerspectiveCamera,
	type Vector3Like,
	WebGLRenderer,
} from 'three'
import type { Land } from '~/ground/land'
import { MouseControl, type MouseEvolution } from '~/utils/mouseControl'

export type MouseEvolutionEvent<Evolution extends MouseEvolution = MouseEvolution> = (
	evolution: Evolution
) => void

export abstract class GameEntity {
	constructor(public readonly o3d: Object3D) {}
	progress(dt: number) {}
}

export class Game extends MouseControl {
	public readonly lights = new Group()
	private _land: Land

	constructor(
		land: Land,
		{ clampCamZ = { min: 150, max: 500 } }: { clampCamZ?: { min: number; max: number } } = {}
	) {
		super(clampCamZ)
		this._land = land
		this.lights.add(new AmbientLight(0x404040))
		const light = new DirectionalLight(0xffffff, 1)
		light.position.set(0, 0, 300)
		light.target.position.set(0, 0, 0)
		this.lights.add(light)
		this.lights.updateMatrixWorld(true)
		this.scene.add(this.lights, land.group, this.entitiesGroup)
	}

	// #region Events

	private readonly mouseEvents: Record<string, Set<MouseEvolutionEvent>> = {}
	onMouse<Evolution extends { type: Evolution['type'] } & MouseEvolution>(
		type: Evolution['type'],
		evolution: MouseEvolutionEvent<Evolution>
	) {
		this.mouseEvents[type as string] ??= new Set()
		this.mouseEvents[type as string].add(evolution as MouseEvolutionEvent)
		return () => this.mouseEvents[type as string]?.delete(evolution as MouseEvolutionEvent)
	}

	// #endregion
	// #region Game entities

	private _entities = new Set<GameEntity>()
	private entitiesGroup = new Group()
	entities() {
		return this._entities.values()
	}
	addEntity(entity: GameEntity) {
		this._entities.add(entity)
		this.entitiesGroup.add(entity.o3d)
	}

	// #endregion
	// #region Progress

	progress(dt: number) {
		for (const entity of this._entities) entity.progress(dt)
		this.land.progress(dt)
	}
	animate = () => {
		if (!this.clock.running) return
		const dt = this.clock.getDelta()
		for (const evolution of this.evolutions()) {
			const listeners = this.mouseEvents[evolution.type]
			if (listeners) for (const listener of listeners) listener(evolution)
		}
		this.updateViews()
		this.progress(dt)
		for (const view of this.views.values()) view.render()
		if (this.clock.running) requestAnimationFrame(this.animate)
	}
	private clock = new Clock(false)
	set running(value: boolean) {
		if (this.clock.running === value) return
		if (value) {
			this.clock.start()
			requestAnimationFrame(this.animate)
		} else {
			this.clock.stop()
		}
	}

	private viewPositions = new WeakMap<GameView, Vector3Like>()
	updateViews() {
		const movedViews: GameView[] = []
		for (const view of this.views.values()) {
			const { camera } = view
			const oldViewPosition = this.viewPositions.get(view)
			if (!oldViewPosition || !camera.position.equals(oldViewPosition)) {
				this.viewPositions.set(view, camera.position.clone())
				movedViews.push(view)
			}
		}
		if (movedViews.length)
			this.land.updateViews(Array.from(this.views.values().map((v) => v.camera)))
	}

	// #endregion
	// #region Composition

	get land() {
		return this._land
	}
	set land(value) {
		this.scene.remove(this._land.group)
		this.scene.add(value.group)
		this._land = value
	}

	createView(
		canvas?: HTMLCanvasElement,
		{ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 1000 }
	) {
		const view = new GameView(this, canvas, { near, far })
		this.listenTo(view)
		return view
	}
	removeView(view: GameView) {
		this.disengage(view)
	}

	// #endregion
}

export class GameView {
	public readonly camera
	private readonly renderer
	constructor(
		public readonly game: Game,
		canvas?: HTMLCanvasElement,
		{ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 1000 }
	) {
		this.camera = new PerspectiveCamera(75, 1, near, far)
		this.renderer = new WebGLRenderer({ canvas, antialias: true })
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
}
