import type { GameView } from '~/game'
import { TileHandle } from '~/ground'
import { type ModKeyCombination, MouseButton, type MouseHandle, modKeysComb } from './types'

const vagueTarget = Symbol('vagueTarget')
const pointTarget = Symbol('pointTarget')

// #region Generics
interface D3MouseEvent {
	gameView: GameView
}

interface ActionConfiguration {
	type: string
	modifiers: ModKeyCombination
}

interface D3MouseAction<Event extends D3MouseEvent, Configuration extends ActionConfiguration> {
	event: Event
	configuration: Configuration
}
type ExtractActionEvent<Action extends D3MouseAction<any, any>> = Action['event'] extends infer E
	? E
	: never

type ExtractActionConfiguration<Action extends D3MouseAction<any, any>> = Action['configuration']

interface MouseActions {
	[key: string]: D3MouseAction<any, any>
}

type InterfaceEvents<Actions extends MouseActions = MouseActions> = {
	[K in keyof Actions]: (event: ExtractActionEvent<Actions[K]>) => void
}

type InterfaceTargetedEvents<Target, Actions extends MouseActions = MouseActions> = {
	[K in keyof Actions]: (target: Target, event: ExtractActionEvent<Actions[K]>) => void
} & {
	hovered(target: Target | undefined, event: D3MouseEvent): void
}
type InterfaceConfigurations<Actions extends MouseActions = MouseActions> = {
	[K in keyof Actions]: ExtractActionConfiguration<Actions[K]>
}

type InterfaceOf<Actions extends MouseActions> = Record<keyof Actions, any>

// #endregion
// #region Specifics

interface OneButtonConfiguration extends ActionConfiguration {
	type: 'click' | 'dblclick'
	button: MouseButton
}

interface KeyPressConfiguration extends ActionConfiguration {
	type: 'press'
	// TODO: code ?
	code: string
}

interface MouseWheelConfiguration extends ActionConfiguration {
	type: 'wheelX' | 'wheelY'
}

interface KeyPairPressConfiguration extends ActionConfiguration {
	type: 'press'
	// TODO: code ?
	codeN: string
	codeP: string
}

interface OneButtonAction
	extends D3MouseAction<D3MouseEvent, OneButtonConfiguration | KeyPressConfiguration> {}

interface Scroll1DEvent extends D3MouseEvent {
	delta: number
}

interface Scroll1DAction
	extends D3MouseAction<Scroll1DEvent, MouseWheelConfiguration | KeyPairPressConfiguration> {}

// #endregion
// #region Modes

//type InterfaceMode<Actions extends MouseActions> =

// #endregion
// #region Test

interface GameXActions extends MouseActions {
	select: OneButtonAction
	activate: OneButtonAction
	zoom: Scroll1DAction
}

const cfg: InterfaceConfigurations<GameXActions> = {
	select: {
		type: 'click',
		modifiers: modKeysComb.none,
		button: MouseButton.Left,
	},
	activate: {
		type: 'press',
		modifiers: modKeysComb.ctrl,
		code: 'a',
	},
	zoom: {
		type: 'wheelY',
		modifiers: modKeysComb.none,
	},
}

const evt: InterfaceEvents<GameXActions> = {
	select(evt) {},
	activate(evt) {},
	zoom(evt) {},
}

// #endregion

function handledActions<T extends new (...args: any) => MouseHandle, Actions extends MouseActions>(
	classConstructor: T,
	mode: InterfaceTargetedEvents<InstanceType<T>, Actions>
): void {
	// Do something with the classConstructor and callback
}

handledActions(TileHandle, {
	select(tile, event) {},
	activate(tile, event) {},
	zoom(tile, event) {},
	hovered(tile, event) {},
	qwerty() {},
})
