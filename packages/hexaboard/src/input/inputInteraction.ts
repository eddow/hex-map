import type { IVector2Like, IVector3Like, PickingInfo } from '@babylonjs/core'
import type { GameView } from '~/game'
import { debugInformation } from '~/utils'
import type {
	D3InputEvent,
	InputActions,
	InterfaceConfigurations,
	SelectiveAction,
} from './actions'
import { D2Buffer } from './d2buffer'
import { type ActionState, type InputState, configuration2event } from './internals'

export type MouseHandler<Handle extends MouseHandle | undefined = MouseHandle | undefined> = (
	intersection: PickingInfo
) => Handle | undefined

export abstract class MouseHandle {
	constructor(public readonly sender: any) {}
	abstract equals(other: MouseHandle): boolean
}

export interface Intersections {
	point?: IVector3Like
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
	public temporaryMode?: InputMode<Actions>
	constructor(
		public readonly gameView: GameView,
		private configurations: InterfaceConfigurations<Actions>,
		private readonly globalMode: InputMode<Actions>,
		public usedMode?: InputMode<Actions>
	) {
		super()
		gameView.game.on('progress', this.dispatchEvents)
		this.listenTo(gameView.canvas)
		this.compileCache()
	}

	setMode(mode: InputMode<Actions>) {
		this.usedMode = mode
		if (!this.temporaryMode) this.compileCache()
	}

	configure(configurations: InterfaceConfigurations<Actions>) {
		this.configurations = configurations
		this.compileCache()
	}

	private tempMode(temporaryMode?: InputMode<Actions>) {
		this.temporaryMode = temporaryMode
		this.compileCache()
	}

	// #region config+modes -> actions

	private compiledCache: Partial<ModesCache<Actions>> = {}
	private actionStates: Partial<Record<keyof Actions, ActionState>> = {}
	private compileCache() {
		const secondaryMode = this.temporaryMode ?? this.usedMode
		const modes = secondaryMode ? [this.globalMode, secondaryMode] : [this.globalMode]
		const configurations = this.configurations
		const cache = {} as Partial<ModesCache<Actions>>
		const actionStates: Partial<Record<keyof Actions, ActionState>> = {}

		for (const mode of modes) {
			for (const selectiveAction of mode.selectiveActions) {
				for (const actionKey of selectiveAction.actionKeys) {
					actionStates[actionKey as keyof Actions] = {}
					for (const configuration of configurations[actionKey]) {
						cache[configuration.type] ??= {}
						cache[configuration.type]![actionKey] ??= []
						cache[configuration.type]![actionKey].push(selectiveAction)
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

	dispose() {
		this.gameView.game.off('progress', this.dispatchEvents)
		this.unListenTo(this.gameView.canvas)
	}

	mouseIntersections(position: IVector2Like): Intersections {
		const {
			gameView: { scene },
		} = this

		const picks = scene
			.multiPick(position.x, position.y)
			?.filter((pick) => !!pick.pickedMesh?.metadata?.mouseHandler)
		if (!picks?.length) return { handles: [] }
		const point = picks[0].pickedPoint
		// Filter by distance THEN by o3d.renderOrder
		picks.sort((a, b) =>
			a.distance !== b.distance
				? a.distance - b.distance
				: b.pickedMesh!.renderingGroupId - a.pickedMesh!.renderingGroupId
		)
		const handles = picks
			.map((intersection) =>
				(intersection.pickedMesh!.metadata.mouseHandler as MouseHandler)(intersection)
			)
			.filter(Boolean) as MouseHandle[]
		return { point: picks[0].pickedPoint!, handles }
	}
	public isLocking?: Intersections
	dispatchEvents = (dt: number) => {
		const { gameView } = this
		const { modifiers, mouse, deltaMouse, deltaWheel, keysDown } = this.snapshot()
		const intersections = mouse && this.mouseIntersections(mouse.position)
		debugInformation.set('intersection', intersections?.point)
		const state: InputState = {
			modifiers,
			buttons: mouse ? mouse.buttons : 0,
			deltaMouse,
			deltaWheel,
			keysDown,
		}
		const tryEvent = (type: string, additionalState?: Partial<InputState>) =>
			this.applyEvent(
				type,
				this.isLocking ?? intersections,
				additionalState ? { ...state, ...additionalState } : state,
				{ gameView, inputInteraction: this },
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
			const shouldLock = !!tryEvent('delta')
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

//TODO: drag&drop
