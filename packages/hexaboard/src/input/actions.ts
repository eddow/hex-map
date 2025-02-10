import { Vector2, type Vector2Like, Vector3, type Vector3Like } from 'three'
import { clamp } from 'three/src/math/MathUtils'
import type { GameView } from '~/game'
import type { InputInteraction, MouseHandle } from './inputInteraction'
import {
	type AnyConfiguration,
	type InputState,
	switchConfiguration,
	transformers,
} from './internals'
import type { ModKeyCombination, MouseButton, MouseButtons } from './d2buffer'

// #region Generics
export interface D3InputEvent {
	gameView: GameView
	inputInteraction: InputInteraction
}

export type SwitchableConfiguration<Options, Values extends {}> =
	| Options
	| { on: Options; use: Values }[]

export interface ActionConfiguration<Cases extends {} = {}> {
	type: string
	modifiers: SwitchableConfiguration<ModKeyCombination, Cases>
}

export interface D3InputAction<
	Event extends D3InputEvent,
	Configuration extends ActionConfiguration,
> {
	type: string
	event: Event
	configuration: Configuration
}
export type ExtractActionEvent<Action extends D3InputAction<any, any>> =
	Action['event'] extends infer E ? E : never

export type ExtractActionConfiguration<Action extends D3InputAction<any, any>> =
	Action['configuration']

export interface InputActions {
	[key: PropertyKey]: D3InputAction<any, any>
}

export type InterfaceEvents<Actions extends InputActions = InputActions> = {
	[K in keyof Actions]: (event: ExtractActionEvent<Actions[K]>) => void
}

export type InterfaceTargetedEvents<Target, Actions extends InputActions = InputActions> = {
	[K in keyof Actions]: (target: Target, event: ExtractActionEvent<Actions[K]>) => void
}
export type InterfaceConfigurations<Actions extends InputActions = InputActions> = {
	[K in keyof Actions]: ExtractActionConfiguration<Actions[K]>[]
}

// #endregion
// #region Specifics

export interface KeyIdentifier {
	key?: string
	code: string
}

/**
 * Calculate the velocity of the scroll on keypress
 * @param accNeg
 * @param accPos
 * @param dt
 * @param velocity
 * @returns number
 */
function keyboardScroll(
	accNeg: boolean | undefined,
	accPos: boolean | undefined,
	dt: number,
	velocity: number | undefined,
	multiplier?: number
) {
	//
	accNeg ??= false
	accPos ??= false
	velocity ??= 0

	if (multiplier) velocity /= multiplier ?? 0
	const clampVelocity =
		Math.abs(velocity) < scrollKbd.clampVelocity
			? scrollKbd.clampVelocity
			: Math.max(Math.abs(velocity) * (1 - scrollKbd.friction) ** dt, scrollKbd.clampVelocity)
	const acceleration = scrollKbd.acceleration * dt * (multiplier ?? 0)
	if (accNeg !== accPos) velocity += accPos ? acceleration : -acceleration
	if (!multiplier || (!accNeg && !accPos)) velocity *= (1 - scrollKbd.friction) ** dt
	velocity = clamp(velocity, -clampVelocity, clampVelocity)
	if (multiplier) velocity *= multiplier
	return Math.abs(velocity) < scrollKbd.min ? 0 : velocity
}
const scrollKbd = {
	acceleration: 2,
	clampVelocity: 1,
	friction: 0.999,
	min: 0.01,
}

interface MultipliedConfiguration {
	multiplier?: number
}

interface HoverConfiguration {
	buttonHoverType?: any
	keyModHoverType?: any
}

// #region OneButton

export interface OneButtonConfiguration extends ActionConfiguration {
	type: 'click' | 'dblclick' | 'mousedown'
	button: MouseButton
}

export interface KeyPressConfiguration extends ActionConfiguration {
	type: 'keydown'
	key: KeyIdentifier
}

function clickTransformer(
	config: AnyConfiguration,
	state: InputState,
	eventBase: D3InputEvent
): D3InputEvent | undefined {
	return 'button' in config && state.button === config.button ? eventBase : undefined
}
transformers({
	click: clickTransformer,
	dblclick: clickTransformer,
	mousedown: clickTransformer,
	keydown(config, state, eventBase): D3InputEvent | undefined {
		return 'key' in config && config.key.code === state.keyCode ? eventBase : undefined
	},
})

export interface OneButtonAction
	extends D3InputAction<D3InputEvent, OneButtonConfiguration | KeyPressConfiguration> {
	type: 'key'
}
export const oneButtonAction: OneButtonAction = {
	type: 'key',
	event: undefined!,
	configuration: undefined!,
}

// #endregion
// #region Scroll1D

export interface Scroll1DEvent extends D3InputEvent {
	delta: number
}

export interface OneWheelConfiguration extends ActionConfiguration {
	type: 'wheelX' | 'wheelY'
}
transformers({
	wheelX(config, state, eventBase): Scroll1DEvent | undefined {
		return state.deltaWheel?.x ? { ...eventBase, delta: state.deltaWheel.x } : undefined
	},
	wheelY(config, state, eventBase): Scroll1DEvent | undefined {
		return state.deltaWheel?.y ? { ...eventBase, delta: state.deltaWheel.y } : undefined
	},
})

export interface KeyPairPressConfiguration
	extends ActionConfiguration<MultipliedConfiguration>,
		MultipliedConfiguration {
	type: 'press2'
	keyNeg: KeyIdentifier
	keyPos: KeyIdentifier
}
transformers({
	press2(config, state, eventBase, dt, actionState): Scroll1DEvent | undefined {
		if ('keyNeg' in config) {
			actionState.keyboardVelocity = keyboardScroll(
				state.keysDown[config.keyNeg.code],
				state.keysDown[config.keyPos.code],
				dt,
				actionState.keyboardVelocity,
				config.multiplier ?? 0
			)
			if (actionState.keyboardVelocity)
				return {
					...eventBase,
					delta: actionState.keyboardVelocity * dt * 10,
				}
		}
	},
})

export interface Scroll1DAction
	extends D3InputAction<Scroll1DEvent, OneWheelConfiguration | KeyPairPressConfiguration> {
	type: 'scroll1'
}
export const scroll1DAction: Scroll1DAction = {
	type: 'scroll1',
	event: undefined!,
	configuration: undefined!,
}

// #endregion
// #region Scroll2D

export interface MouseDeltaConfiguration extends ActionConfiguration {
	type: 'delta'
	buttons: MouseButtons
	invertX: boolean
	invertY: boolean
}
transformers({
	delta(config, state, eventBase): Scroll2DEvent | undefined | true {
		if ('invertX' in config) {
			if (state.buttons === config.buttons)
				return state.deltaMouse
					? {
							...eventBase,
							delta: {
								x: state.deltaMouse.x * (config.invertX ? -1 : 1),
								y: state.deltaMouse.y * (config.invertY ? -1 : 1),
							},
						}
					: true
		}
	},
})

export interface KeyQuadPressConfiguration
	extends ActionConfiguration<MultipliedConfiguration>,
		MultipliedConfiguration {
	type: 'press4'
	keyXNeg: KeyIdentifier
	keyXPos: KeyIdentifier
	keyYNeg: KeyIdentifier
	keyYPos: KeyIdentifier
}
transformers({
	press4(config, state, eventBase, dt, actionState): Scroll2DEvent | undefined {
		if ('keyXNeg' in config) {
			const multiplier = config.multiplier ?? 0
			actionState.keyboardVelocityX = keyboardScroll(
				state.keysDown[config.keyXNeg.code],
				state.keysDown[config.keyXPos.code],
				dt,
				actionState.keyboardVelocityX,
				multiplier
			)
			actionState.keyboardVelocityY = keyboardScroll(
				state.keysDown[config.keyYNeg.code],
				state.keysDown[config.keyYPos.code],
				dt,
				actionState.keyboardVelocityY,
				multiplier
			)
			const velocityVec = new Vector2(actionState.keyboardVelocityX, actionState.keyboardVelocityY)
			let clamp = scrollKbd.clampVelocity
			if (multiplier !== 0) clamp *= multiplier
			const length = velocityVec.length()
			if (length > clamp) {
				const clampMultiplier = clamp / length
				actionState.keyboardVelocityX *= clampMultiplier
				actionState.keyboardVelocityY *= clampMultiplier
			}
			if (actionState.keyboardVelocityX || actionState.keyboardVelocityY)
				return {
					...eventBase,
					delta: {
						x: actionState.keyboardVelocityX * dt * 1000,
						y: actionState.keyboardVelocityY * dt * 1000,
					},
				}
		}
	},
})

export interface Scroll2DEvent extends D3InputEvent {
	delta: Vector2Like
}

export interface Scroll2DAction
	extends D3InputAction<Scroll2DEvent, KeyQuadPressConfiguration | MouseDeltaConfiguration> {
	type: 'scroll2'
}
export const scroll2DAction: Scroll2DAction = {
	type: 'scroll2',
	event: undefined!,
	configuration: undefined!,
}

// #endregion
// #region Hover

export interface MouseHoverConfiguration
	extends ActionConfiguration<HoverConfiguration>,
		HoverConfiguration {
	type: 'hover'
	buttons: SwitchableConfiguration<MouseButtons, HoverConfiguration>
}
transformers({
	hover(config, state, eventBase, dt, actionState): D3InputEvent | undefined {
		if ('buttons' in config && !('invertX' in config)) {
			const modConfig = switchConfiguration(config.buttons, state.buttons)
			if (modConfig)
				return {
					...eventBase,
					buttonHoverType: config.buttonHoverType,
					keyModHoverType: config.keyModHoverType,
					...modConfig,
				}
		}
	},
})

export interface HoverEvent extends D3InputEvent {
	buttonHoverType?: any
	keyModHoverType?: any
}
export interface HoverAction extends D3InputAction<HoverEvent, MouseHoverConfiguration> {
	type: 'hover'
}
export const hoverAction: HoverAction = {
	type: 'hover',
	event: undefined!,
	configuration: undefined!,
}

// #endregion

// #endregion
// #region Events lists

type HandleType = new (...args: any) => MouseHandle

export abstract class SelectiveAction<Actions extends InputActions> {
	constructor(protected readonly actions: Partial<Record<keyof Actions, any>>) {}
	get actionKeys() {
		return Object.keys(this.actions)
	}
	public abstract acceptHandle(handle: MouseHandle): boolean
	public abstract acceptNoHandle(hasPoint: boolean): boolean
	public abstract apply(
		action: keyof Actions,
		handle: MouseHandle | undefined,
		intersection: Vector3Like | undefined,
		event: D3InputEvent
	): void
}

class HandleSelectiveAction<
	T extends HandleType,
	Actions extends InputActions,
> extends SelectiveAction<Actions> {
	constructor(
		private readonly handleType: HandleType,
		protected readonly actions: Partial<InterfaceTargetedEvents<InstanceType<T>, Actions>>,
		private readonly secondaryAccepter?: (handle: InstanceType<T>) => boolean
	) {
		super(actions)
	}
	public acceptNoHandle(hasPoint: boolean): boolean {
		return false
	}
	public acceptHandle(handle: InstanceType<T>): boolean {
		return (
			handle instanceof this.handleType &&
			(!this.secondaryAccepter || this.secondaryAccepter(handle))
		)
	}
	public apply(
		action: keyof Actions,
		handle: MouseHandle | undefined,
		intersection: Vector3Like | undefined,
		event: D3InputEvent
	): void {
		this.actions[action]?.(
			handle as InstanceType<T>,
			event as ExtractActionEvent<Actions[keyof Actions]>
		)
	}
}
export function handledActions<T extends HandleType>(
	handleType: T,
	secondaryAccepter?: (handle: InstanceType<T>) => boolean
): <Actions extends InputActions>(
	actions: Partial<InterfaceTargetedEvents<InstanceType<T>, Actions>>
) => SelectiveAction<Actions> {
	return (actions) => new HandleSelectiveAction(handleType, actions, secondaryAccepter /*, mode*/)
}

class PointSelectiveAction<Actions extends InputActions> extends SelectiveAction<Actions> {
	constructor(protected readonly actions: Partial<InterfaceTargetedEvents<Vector3, Actions>>) {
		super(actions)
	}
	public acceptNoHandle(hasPoint: boolean): boolean {
		return hasPoint
	}
	public acceptHandle(handle: any): boolean {
		return false
	}
	public apply(
		action: keyof Actions,
		handle: MouseHandle | undefined,
		intersection: Vector3Like | undefined,
		event: D3InputEvent
	): void {
		this.actions[action]?.(
			new Vector3().copy(intersection!),
			event as ExtractActionEvent<Actions[keyof Actions]>
		)
	}
}
export function pointActions<Actions extends InputActions>(
	actions: Partial<InterfaceTargetedEvents<Vector3, Actions>>
): SelectiveAction<Actions> {
	return new PointSelectiveAction(actions)
}

class NotSelectiveAction<Actions extends InputActions> extends SelectiveAction<Actions> {
	constructor(protected readonly actions: Partial<InterfaceEvents<Actions>>) {
		super(actions)
	}
	public acceptNoHandle(hasPoint: boolean): boolean {
		return !hasPoint
	}
	public acceptHandle(handle: any): boolean {
		return false
	}
	public apply(
		action: keyof Actions,
		handle: MouseHandle | undefined,
		intersection: Vector3Like | undefined,
		event: D3InputEvent
	): void {
		this.actions[action]?.(event as ExtractActionEvent<Actions[keyof Actions]>)
	}
}
export function viewActions<Actions extends InputActions>(
	actions: Partial<InterfaceEvents<Actions>>
): SelectiveAction<Actions> {
	return new NotSelectiveAction(actions)
}

// #endregion
