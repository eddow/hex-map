import { type Vector2Like, Vector3, type Vector3Like } from 'three'
import type { GameView } from '~/game'
import {
	type ModKeyCombination,
	type MouseButton,
	type MouseButtons,
	type MouseHandle,
	sameModifiers,
} from './types'

// #region Generics
export interface D3InputEvent {
	gameView: GameView
}

export interface ActionConfiguration {
	type: string
	modifiers: ModKeyCombination
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
// #region Transformers

export interface InputState {
	buttons: MouseButtons
	modifiers: ModKeyCombination
	deltaMouse?: Vector2Like
	deltaWheel?: Vector2Like
	button?: MouseButton
}

type AnyConfiguration =
	| ActionConfiguration
	| OneButtonConfiguration
	| MouseDeltaConfiguration
	| MouseHoverConfiguration
	| KeyPressConfiguration
	| OneWheelConfiguration
	| TwoWheelsConfiguration
	| KeyPairPressConfiguration
	| KeyQuadPressConfiguration

export const configurationTransformer: Record<
	string,
	(config: AnyConfiguration, state: InputState, eventBase: D3InputEvent) => D3InputEvent | undefined
> = {}

function transformers(
	nt: Record<
		string,
		(
			config: AnyConfiguration,
			state: InputState,
			eventBase: D3InputEvent
		) => D3InputEvent | undefined
	>
) {
	Object.assign(configurationTransformer, nt)
}

export function configuration2event(
	config: AnyConfiguration,
	state: InputState,
	eventBase: D3InputEvent
): D3InputEvent | undefined {
	if (!sameModifiers(config.modifiers, state.modifiers)) return
	return configurationTransformer[config.type]?.(config, state, eventBase)
}

// #endregion
// #region Specifics

export interface KeyIdentifier {
	key?: string
	code: string
}

// #region OneButton

export interface OneButtonConfiguration extends ActionConfiguration {
	type: 'click' | 'dblclick'
	button: MouseButton
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
})

export interface KeyPressConfiguration extends ActionConfiguration {
	type: 'press'
	key: KeyIdentifier
}

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

export interface KeyPairPressConfiguration extends ActionConfiguration {
	type: 'press2'
	velocity: number
	keyNeg: KeyIdentifier
	keyPos: KeyIdentifier
}

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

export interface TwoWheelsConfiguration extends ActionConfiguration {
	type: 'wheels'
}

export interface KeyQuadPressConfiguration extends ActionConfiguration {
	type: 'press4'
	velocity: number
	keyXNeg: KeyIdentifier
	keyXPos: KeyIdentifier
	keyYNeg: KeyIdentifier
	keyYPos: KeyIdentifier
}

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

export interface MouseHoverConfiguration extends ActionConfiguration {
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
