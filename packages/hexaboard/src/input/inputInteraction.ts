import { Raycaster, Vector2, type Vector2Like, type Vector3Like } from 'three'
import type { GameView } from '~/game'
import { assert } from '~/utils'
import type {
	D3InputEvent,
	InputActions,
	InterfaceConfigurations,
	Scroll1DEvent,
	Scroll2DEvent,
	SelectiveAction,
} from './actions'
import { D2Buffer } from './d2buffer'
import { type ModKeyCombination, type MouseHandle, type MouseHandler, sameModifiers } from './types'

export interface Intersections {
	point?: Vector3Like
	handles: MouseHandle[]
}

export class InputMode<Actions extends InputActions> {
	selectiveActions: SelectiveAction<Actions>[]
	constructor(...actions: SelectiveAction<Actions>[]) {
		this.selectiveActions = actions
	}
}

type InterfaceEventApplication<Actions extends InputActions> = {
	modifiers: ModKeyCombination
	eventKey: string
	selective: SelectiveAction<Actions>
}

export class InputInteraction<Actions extends InputActions = InputActions> extends D2Buffer {
	public views = new Map<HTMLCanvasElement, GameView>()
	constructor(
		private readonly globalMode: InputMode<Actions>,
		configurations: InterfaceConfigurations<Actions>
	) {
		super()
		this.compiledCache = this.compileCache(configurations, [this.globalMode])
	}

	configure(configurations: InterfaceConfigurations<Actions>) {
		this.compiledCache = this.compileCache(configurations, [this.globalMode])
	}

	// #region config+modes -> actions

	private compiledCache: Record<string, InterfaceEventApplication<Actions>[]>
	compileCache(configurations: InterfaceConfigurations<Actions>, modes: InputMode<Actions>[]) {
		const cache = {} as Record<string, InterfaceEventApplication<Actions>[]>

		for (const mode of modes) {
			for (const selectiveAction of mode.selectiveActions) {
				for (const eventKey of selectiveAction.eventKeys) {
					for (const config of configurations[eventKey]) {
						cache[config.type] ??= []
						cache[config.type].push({
							modifiers: config.modifiers,
							selective: selectiveAction,
							eventKey,
						})
					}
				}
			}
		}
		return cache
	}

	applyEvent(
		type: string,
		modifiers: ModKeyCombination,
		intersections: Intersections | undefined,
		event: D3InputEvent
	) {
		const applications = this.compiledCache[type]
		if (!applications) return
		if (intersections) {
			// Try all handles by order they intersect
			for (const handle of intersections.handles) {
				for (const application of applications) {
					if (
						sameModifiers(application.modifiers, modifiers) &&
						application.selective.acceptHandle(handle)
					) {
						application.selective.apply(application.eventKey, handle, intersections.point, event)
						return true
					}
				}
			}
			// Try with a point
			if (intersections.point) {
				for (const application of applications) {
					if (
						sameModifiers(application.modifiers, modifiers) &&
						application.selective.acceptNoHandle(false)
					) {
						application.selective.apply(application.eventKey, undefined, intersections.point, event)
						return true
					}
				}
			}
		}
		// Try with nothing
		for (const application of applications) {
			if (
				sameModifiers(application.modifiers, modifiers) &&
				application.selective.acceptNoHandle(true)
			) {
				application.selective.apply(application.eventKey, undefined, undefined, event)
				return true
			}
		}
	}

	// #endregion

	get game() {
		return this.views.values().next().value!.game
	}

	dispose() {
		for (const view of this.views.values()) this.detach(view)
	}
	attach(gameView: GameView) {
		assert(
			this.views.size === 0 || this.game === gameView.game,
			'Only one game per InputInteraction'
		)
		if (this.views.size === 0) gameView.game.on('progress', this.dispatchEvents)
		this.views.set(gameView.canvas, gameView)
		this.listenTo(gameView.canvas)
		gameView.game.on('progress', (dt) => this.dispatchEvents(dt))
	}
	detach(gameView: GameView) {
		this.views.delete(gameView.canvas)
		if (this.views.size === 0) gameView.game.off('progress', this.dispatchEvents)
		this.unListenTo(gameView.canvas)
	}

	private readonly rayCaster = new Raycaster()
	mouseIntersections(gameView: GameView, position: Vector2Like): Intersections {
		const { canvas, camera } = gameView
		const mouse = new Vector2(
			(position.x / canvas.clientWidth) * 2 - 1,
			-(position.y / canvas.clientHeight) * 2 + 1
		)
		this.rayCaster.setFromCamera(mouse, camera)

		const intersections = this.rayCaster.intersectObjects(this.game.scene.children)
		if (!intersections?.length) return { handles: [] }
		const point = intersections[0].point
		// Filter by distance THEN by o3d.renderOrder
		intersections.sort((a, b) =>
			a.distance !== b.distance
				? a.distance - b.distance
				: b.object.renderOrder - a.object.renderOrder
		)
		const handles = intersections
			.map((intersection) =>
				(intersection.object?.userData?.mouseHandler as MouseHandler)?.(intersection)
			)
			.filter(Boolean) as MouseHandle[]
		return { point, handles }
	}
	dispatchEvents = (dt: number) => {
		const gameView = this.activeElement && this.views.get(this.activeElement as HTMLCanvasElement)
		if (this.size && gameView) {
			const { modifiers, mouse, previous, deltaMouse, deltaWheel } = this.snapshot()
			const intersections = mouse && this.mouseIntersections(gameView, mouse.position)
			const tryEvent = <Event extends D3InputEvent>(type: string, event: Event) =>
				this.applyEvent(type, modifiers, intersections, event)
			const eventBase: D3InputEvent = {
				gameView,
			}
			if (mouse) {
				if (deltaWheel) {
					if (
						!tryEvent<Scroll2DEvent>('wheels', {
							...eventBase,
							delta: deltaWheel,
						})
					) {
						if (deltaWheel.y)
							tryEvent<Scroll1DEvent>('wheelY', {
								...eventBase,
								delta: deltaWheel.y,
							})
						if (deltaWheel.x)
							tryEvent<Scroll1DEvent>('wheelX', {
								...eventBase,
								delta: deltaWheel.x,
							})
					}
				}
			}
			for (const event of this.events()) {
				//console.log(event.type, event)
				/*
OneButtonConfiguration
MouseDeltaConfiguration
MouseHoverConfiguration
KeyPressConfiguration
OneWheelConfiguration
TwoWheelsConfiguration
KeyPairPressConfiguration
KeyQuadPressConfiguration


'click'
'dblclick'
'delta'
'hover'
'press'
'wheelX'
'wheelY'
'wheels'
'press2'
'press4'
*/
			}
		}
	}
}
