import {
	AmbientLight,
	Clock,
	DirectionalLight,
	Group,
	type Object3D,
	Scene,
	type Vector3Like,
} from 'three'
import type { Land, TileBase } from '~/ground/land'
import type { MouseEvolution } from '~/input'
import type { InputInteraction } from '~/input/d3events'
import { Eventful } from '~/utils'
import { GameView } from './gameView'

export type MouseEvolutionEvent<Evolution extends MouseEvolution = MouseEvolution> = (
	evolution: Evolution
) => void

export abstract class GameEntity {
	constructor(public readonly o3d: Object3D) {}
	progress(dt: number) {}
}

export type GameEvents = {
	progress(dt: number): void
}

export class Game<Tile extends TileBase = TileBase> extends Eventful<GameEvents> {
	public readonly views = new Map<GameView, InputInteraction | null>()
	public readonly lights = new Group()
	public readonly scene = new Scene()
	private _land: Land<Tile>

	constructor(
		land: Land<Tile>,
		private readonly mainGameInteraction: InputInteraction
	) {
		super()
		this._land = land
		this.lights.add(new AmbientLight(0x404040))
		const light = new DirectionalLight(0xffffff, 1)
		light.position.set(0, 0, 300)
		light.target.position.set(0, 0, 0)
		this.lights.add(light)
		this.lights.updateMatrixWorld(true)
		this.scene.add(this.lights, land.group, this.entitiesGroup)
	}

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
		this.emit('progress', dt)
		this.updateViews()
		this.progress(dt)
		for (const view of this.views.keys()) view.render()
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
		for (const view of this.views.keys()) {
			const { camera } = view
			const oldViewPosition = this.viewPositions.get(view)
			if (!oldViewPosition || !camera.position.equals(oldViewPosition)) {
				this.viewPositions.set(view, camera.position.clone())
				movedViews.push(view)
			}
		}
		if (movedViews.length) this.land.updateViews(Array.from(this.views.keys().map((v) => v.camera)))
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
		interaction: InputInteraction | null = this.mainGameInteraction,
		{ near = 0.1, far = 1000 }: { near: number; far: number } = { near: 0.1, far: 2000 }
	) {
		// @ts-ignore Ignore tiles for the views
		const view = new GameView(this, canvas, interaction, { near, far })
		this.views.set(view, interaction)
		this.scene.add(view.camera)
		interaction?.attach(view)
		return view
	}
	removeView(view: GameView) {
		this.views.get(view)?.detach(view)
		this.views.delete(view)
		this.scene.remove(view.camera)
	}

	// #endregion
}
