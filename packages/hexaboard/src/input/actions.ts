import { Vector2, type Vector2Like, Vector3, type Vector3Like } from 'three'
import { clamp } from 'three/src/math/MathUtils'
import type { GameView } from '~/game'
import { type AnyConfiguration, type InputState, transformers } from './internals'
import type { ModKeyCombination, MouseButton, MouseButtons, MouseHandle } from './types'

// #region Generics
export interface D3InputEvent {
	gameView: GameView
}

export interface ActionConfiguration<Final extends {} = {}> {
	type: string
	modifiers: ModKeyCombination | { on: ModKeyCombination; use: Partial<Final> }[]
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
	[key: string]: D3InputAction<any, any>
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
 * Gets the velocity of the scroll
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
	accNeg ??= false
	accPos ??= false
	velocity ??= 0
	if (multiplier === 0) accNeg = accPos = false
	else velocity /= multiplier ?? 1
	const acceleration = scrollKbd.acceleration * dt * (multiplier ?? 1)
	if (accNeg !== accPos) velocity += accPos ? acceleration : -acceleration
	else if (!accNeg) velocity *= (1 - scrollKbd.friction) ** dt
	velocity = clamp(velocity, -scrollKbd.clampVelocity, scrollKbd.clampVelocity)
	if (multiplier !== 0) velocity *= multiplier ?? 1
	return Math.abs(velocity) < scrollKbd.min ? 0 : velocity
}
const scrollKbd = {
	acceleration: 2,
	clampVelocity: 1,
	friction: 0.99,
	min: 0.01,
}

interface MultipliedConfiguration {
	multiplier?: number
}

// #region OneButton

export interface OneButtonConfiguration extends ActionConfiguration {
	type: 'click' | 'dblclick'
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
				config.multiplier ?? 1
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

// TODO
export interface MouseDeltaConfiguration extends ActionConfiguration {
	type: 'delta'
	buttons: MouseButtons
	invertX: boolean
	invertY: boolean
}

// TODO
export interface TwoWheelsConfiguration extends ActionConfiguration {
	type: 'wheels'
}

// TODO
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
			const multiplier = config.multiplier ?? 1
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

// TODO
export interface Scroll2DEvent extends D3InputEvent {
	delta: Vector2Like
}

export interface Scroll2DAction
	extends D3InputAction<
		Scroll2DEvent,
		TwoWheelsConfiguration | KeyQuadPressConfiguration | MouseDeltaConfiguration
	> {
	type: 'scroll2'
}
export const scroll2DAction: Scroll2DAction = {
	type: 'scroll2',
	event: undefined!,
	configuration: undefined!,
}

// #endregion
// #region Hover
// TODO
export interface MouseHoverConfiguration extends ActionConfiguration<MouseHoverConfiguration> {
	type: 'hover'
	buttons: MouseButtons
}

export interface HoverAction extends D3InputAction<D3InputEvent, MouseHoverConfiguration> {
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
