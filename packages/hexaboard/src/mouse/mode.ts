import { type Vector2Like, Vector3, type Vector3Like } from 'three'
import type { GameView } from '~/game'
import type { ModKeyCombination, MouseButton, MouseButtons, MouseHandle } from './types'

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
	[K in keyof Actions]: [ExtractActionConfiguration<Actions[K]>]
}

// #endregion
// #region Specifics

export interface OneButtonConfiguration extends ActionConfiguration {
	type: 'click' | 'dblclick'
	button: MouseButton
}

export interface MouseDeltaConfiguration extends ActionConfiguration {
	type: 'delta'
	buttons: MouseButtons
	invertX: boolean
	invertY: boolean
}

export interface MouseHoverConfiguration extends ActionConfiguration {
	type: 'hover'
	buttons: MouseButtons
}

export interface KeyIdentifier {
	name: string
	code: string
}

export interface KeyPressConfiguration extends ActionConfiguration {
	type: 'press'
	key: KeyIdentifier
}

export interface OneWheelConfiguration extends ActionConfiguration {
	type: 'wheelX' | 'wheelY'
}
export interface TwoWheelsConfiguration extends ActionConfiguration {
	type: 'wheels'
}

export interface KeyPairPressConfiguration extends ActionConfiguration {
	type: 'press2'
	keyNeg: KeyIdentifier
	keyPos: KeyIdentifier
}

export interface KeyQuadPressConfiguration extends ActionConfiguration {
	type: 'press4'
	keyXNeg: KeyIdentifier
	keyXPos: KeyIdentifier
	keyYNeg: KeyIdentifier
	keyYPos: KeyIdentifier
}

export interface Scroll1DEvent extends D3InputEvent {
	delta: number
}

export interface Scroll2DEvent extends D3InputEvent {
	delta: Vector2Like
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

export interface HoverAction extends D3InputAction<D3InputEvent, MouseHoverConfiguration> {
	type: 'hover'
}
export const hoverAction: HoverAction = {
	type: 'hover',
	event: undefined!,
	configuration: undefined!,
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
// #region Events lists

type HandleType = new (...args: any) => MouseHandle

export abstract class SelectiveAction<Actions extends InputActions> {
	public abstract acceptHandle(handle: MouseHandle): boolean
	public abstract acceptNoHandle(pointless: boolean): boolean
	public abstract apply(
		action: keyof Actions,
		handle: MouseHandle,
		intersection: Vector3Like,
		event: D3InputEvent
	): void
}

class HandleSelectiveAction<
	T extends HandleType,
	Actions extends InputActions,
> extends SelectiveAction<Actions> {
	constructor(
		private readonly handleType: HandleType,
		private readonly events: Partial<InterfaceTargetedEvents<InstanceType<T>, Actions>>,
		private readonly secondaryAccepter?: (handle: InstanceType<T>) => boolean
	) {
		super()
	}
	public acceptNoHandle(pointless: boolean): boolean {
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
		handle: MouseHandle,
		intersection: Vector3Like,
		event: D3InputEvent
	): void {
		this.events[action]?.(
			handle as InstanceType<T>,
			event as ExtractActionEvent<Actions[keyof Actions]>
		)
	}
}

export function handledActions<T extends HandleType>(
	handleType: T,
	secondaryAccepter?: (handle: InstanceType<T>) => boolean
): <Actions extends InputActions>(
	events: Partial<InterfaceTargetedEvents<InstanceType<T>, Actions>>
) => SelectiveAction<Actions> {
	return (events) => new HandleSelectiveAction(handleType, events, secondaryAccepter /*, mode*/)
}

class PointSelectiveAction<Actions extends InputActions> extends SelectiveAction<Actions> {
	constructor(private readonly events: Partial<InterfaceTargetedEvents<Vector3, Actions>>) {
		super()
	}
	public acceptNoHandle(pointless: boolean): boolean {
		return !pointless
	}
	public acceptHandle(handle: any): boolean {
		return true
	}
	public apply(
		action: keyof Actions,
		handle: MouseHandle,
		intersection: Vector3Like,
		event: D3InputEvent
	): void {
		this.events[action]?.(
			new Vector3().copy(intersection),
			event as ExtractActionEvent<Actions[keyof Actions]>
		)
	}
}

export function pointActions<Actions extends InputActions>(
	events: Partial<InterfaceTargetedEvents<Vector3, Actions>>
): SelectiveAction<Actions> {
	return new PointSelectiveAction(events)
}

class NotSelectiveAction<Actions extends InputActions> extends SelectiveAction<Actions> {
	constructor(private readonly events: Partial<InterfaceEvents<Actions>>) {
		super()
	}
	public acceptNoHandle(pointless: boolean): boolean {
		return true
	}
	public acceptHandle(handle: any): boolean {
		return true
	}
	public apply(
		action: keyof Actions,
		handle: MouseHandle,
		intersection: Vector3Like,
		event: D3InputEvent
	): void {
		this.events[action]?.(event as ExtractActionEvent<Actions[keyof Actions]>)
	}
}

export function viewActions<Actions extends InputActions>(
	events: Partial<InterfaceEvents<Actions>>
): SelectiveAction<Actions> {
	return new NotSelectiveAction(events)
}

// #endregion
