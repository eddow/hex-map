import { Raycaster, Vector2, type Vector2Like, type Vector3Like } from 'three'
import type { GameView } from '~/game'
import { assert, debugInformation } from '~/utils'
import {
	type D3InputEvent,
	type InputActions,
	type InputState,
	type InterfaceConfigurations,
	type SelectiveAction,
	configuration2event,
} from './actions'
import { D2Buffer } from './d2buffer'
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
	compileCache(configurations: InterfaceConfigurations<Actions>, modes: InputMode<Actions>[]) {
		const cache = {} as ModesCache<Actions>

		for (const mode of modes) {
			for (const selectiveAction of mode.selectiveActions) {
				for (const actionKey of selectiveAction.actionKeys) {
					for (const configuration of configurations[actionKey]) {
						cache[configuration.type] ??= {}
						cache[configuration.type][actionKey] ??= []
						cache[configuration.type][actionKey].push(selectiveAction)
					}
				}
			}
		}
		this.compiledCache = cache
	}

	applyEvent(
		configurationType: string,
		intersections: Intersections | undefined,
		state: InputState,
		eventBase: D3InputEvent
	) {
		const applications = this.compiledCache[configurationType]
		if (!applications) return
		const applicableActions: Record<
			string,
			{ event: D3InputEvent; selectiveList: SelectiveAction<Actions>[] }
		> = {}
		// 1- build cache of application/events

		for (const action in applications) {
			let event: D3InputEvent | undefined
			for (const configuration of this.configurations[action]) {
				event = configuration2event(configuration, state, eventBase)
				if (event) break
			}
			if (event)
				applicableActions[action] = {
					event,
					selectiveList: applications[action],
				}
		}
		// 2- apply to most demanding (handles - point - gameView)
		if (!applications) return
		if (intersections) {
			// Try all handles by order they intersect
			for (const handle of intersections.handles) {
				for (const action in applicableActions) {
					for (const selective of applicableActions[action].selectiveList) {
						if (selective.acceptHandle(handle)) {
							selective.apply(action, handle, intersections.point, applicableActions[action].event)
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
			debugInformation.set('intersection', intersections?.point)
			const state: InputState = {
				modifiers,
				buttons: mouse ? mouse.buttons : 0,
				deltaMouse,
				deltaWheel,
			}
			const tryEvent = (type: string, additionalState?: Partial<InputState>) =>
				this.applyEvent(
					type,
					intersections,
					additionalState ? { ...state, ...additionalState } : state,
					{ gameView }
				)
			if (mouse) {
				if (deltaWheel) {
					if (!tryEvent('wheels')) {
						if (deltaWheel.y) tryEvent('wheelY')
						if (deltaWheel.x) tryEvent('wheelX')
					}
				}
			}
			for (const event of this.events()) {
				switch (event.type) {
					case 'click':
					case 'dblclick':
						tryEvent(event.type, { button: (event as MouseEvent).button })
						break
				}
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
