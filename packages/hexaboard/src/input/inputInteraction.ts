import { Raycaster, Vector2, type Vector2Like, type Vector3Like } from 'three'
import type { GameView } from '~/game'
import { assert, debugInformation } from '~/utils'
import type {
	D3InputEvent,
	InputActions,
	InterfaceConfigurations,
	SelectiveAction,
} from './actions'
import { D2Buffer } from './d2buffer'
import { type ActionState, type InputState, configuration2event } from './internals'
import type { MouseHandle, MouseHandler } from './types'

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

type ModesCache<Actions extends InputActions> = Record<
	string,
	Record<string, SelectiveAction<Actions>[]>
>

export class InputInteraction<Actions extends InputActions = InputActions> extends D2Buffer {
	public views = new Map<HTMLCanvasElement, GameView>()
	constructor(
		private readonly globalMode: InputMode<Actions>,
		private configurations: InterfaceConfigurations<Actions>
	) {
		super()
		this.compileCache(configurations, [this.globalMode])
	}

	configure(configurations: InterfaceConfigurations<Actions>) {
		this.configurations = configurations
	}

	// #region config+modes -> actions

	private compiledCache: ModesCache<Actions> = {}
	private actionStates: Record<string, ActionState> = {}
	compileCache(configurations: InterfaceConfigurations<Actions>, modes: InputMode<Actions>[]) {
		const cache = {} as ModesCache<Actions>
		const actionStates: Record<string, ActionState> = {}

		for (const mode of modes) {
			for (const selectiveAction of mode.selectiveActions) {
				for (const actionKey of selectiveAction.actionKeys) {
					actionStates[actionKey] = {}
					for (const configuration of configurations[actionKey]) {
						cache[configuration.type] ??= {}
						cache[configuration.type][actionKey] ??= []
						cache[configuration.type][actionKey].push(selectiveAction)
					}
				}
			}
		}
		this.compiledCache = cache
		this.actionStates = actionStates
	}

	applyEvent(
		configurationType: string,
		intersections: Intersections | undefined,
		state: InputState,
		eventBase: D3InputEvent,
		dt: number
	) {
		// TODO: several actions with same configuration
		const applications = this.compiledCache[configurationType]
		if (!applications) return
		const applicableActions: Record<
			string,
			{ event: D3InputEvent | true; selectiveList: SelectiveAction<Actions>[] }
		> = {}
		// 1- build cache of application/events

		for (const action in applications) {
			let event: D3InputEvent | undefined | true
			for (const configuration of this.configurations[action])
				if (configuration.type === configurationType) {
					event = configuration2event(
						configuration,
						state,
						eventBase,
						dt,
						this.actionStates[action]
					)
					if (event) break
				}
			if (event)
				applicableActions[action] = {
					event,
					selectiveList: applications[action],
				}
		}
		// 2- apply to most demanding (handles - point - gameView)
		if (intersections) {
			// Try all handles by order they intersect
			for (const handle of intersections.handles) {
				for (const action in applicableActions) {
					for (const selective of applicableActions[action].selectiveList) {
						if (selective.acceptHandle(handle)) {
							if (applicableActions[action].event !== true)
								selective.apply(
									action,
									handle,
									intersections.point,
									applicableActions[action].event
								)
							return true
						}
					}
				}
			}
			// Try with a point
			if (intersections.point) {
				for (const action in applicableActions) {
					for (const selective of applicableActions[action].selectiveList) {
						if (selective.acceptNoHandle(true)) {
							if (applicableActions[action].event !== true)
								selective.apply(
									action,
									undefined,
									intersections.point,
									applicableActions[action].event
								)
							return true
						}
					}
				}
			}
		}
		// Try with nothing
		for (const action in applicableActions) {
			for (const selective of applicableActions[action].selectiveList) {
				if (selective.acceptNoHandle(false)) {
					if (applicableActions[action].event !== true)
						selective.apply(action, undefined, undefined, applicableActions[action].event)
					return true
				}
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

		const intersections = this.rayCaster
			.intersectObjects(this.game.scene.children)
			.filter((intersection) => !!intersection.object?.userData?.mouseHandler)
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
				(intersection.object.userData.mouseHandler as MouseHandler)(intersection)
			)
			.filter(Boolean) as MouseHandle[]
		return { point, handles }
	}
	public isLocking?: Intersections
	dispatchEvents = (dt: number) => {
		const gameView = this.activeElement && this.views.get(this.activeElement as HTMLCanvasElement)
		if (gameView) {
			const { modifiers, mouse, deltaMouse, deltaWheel, keysDown } = this.snapshot()
			const intersections = mouse && this.mouseIntersections(gameView, mouse.position)
			debugInformation.set('intersection', intersections?.point)
			const state: InputState = {
				modifiers,
				buttons: mouse ? mouse.buttons : 0,
				deltaMouse,
				deltaWheel,
				keysDown,
			}
			const tryEvent = (type: string, additionalState?: Partial<InputState>, locking = false) =>
				this.applyEvent(
					type,
					this.isLocking && !locking ? undefined : (this.isLocking ?? intersections),
					additionalState ? { ...state, ...additionalState } : state,
					{ gameView },
					dt
				)

			for (const event of this.events()) {
				switch (event.type) {
					case 'mousedown':
					case 'click':
					case 'dblclick':
						tryEvent(event.type, { button: (event as MouseEvent).button })
						break
					case 'keydown':
						tryEvent(event.type, { keyCode: (event as KeyboardEvent).code })
						break
					case 'mouseleave':
						tryEvent('hover')
						break
				}
			}
			if (mouse) {
				tryEvent('hover')
				if (deltaWheel) {
					if (!tryEvent('wheels')) {
						if (deltaWheel.y) tryEvent('wheelY')
						if (deltaWheel.x) tryEvent('wheelX')
					}
				}
				const shouldLock = !!tryEvent('delta', undefined, true)
				if (shouldLock === !this.isLocking) {
					if (this.isLocking) {
						this.isLocking = undefined
						document.exitPointerLock()
					} else {
						this.isLocking = intersections
						gameView.canvas.requestPointerLock()
					}
				}
			}
			tryEvent('press2')
			tryEvent('press4')
		}
	}
}
