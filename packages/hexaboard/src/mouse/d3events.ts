import { TileHandle } from '~/ground'
import { D2Buffer } from './d2buffer'
import {
	type HoverAction,
	type InputActions,
	type InterfaceConfigurations,
	type InterfaceEvents,
	type OneButtonAction,
	type Scroll1DAction,
	type Scroll2DAction,
	type SelectiveAction,
	handledActions,
	pointActions,
} from './mode'
import { MouseButton, MouseButtons, modKeyCombination } from './types'

export class InputMode<Actions extends InputActions> {
	actions: SelectiveAction<Actions>[]
	constructor(...actions: SelectiveAction<Actions>[]) {
		this.actions = actions
	}
}
export class MouseModesManager<Actions extends InputActions> extends D2Buffer {
	constructor(
		private readonly globalMode: InputMode<Actions>,
		private configurations: InterfaceConfigurations<Actions>
	) {
		super()
	}
	// TODO
	dispatchEvents() {}
}

// #region Test

interface GameXActions extends InputActions {
	select: OneButtonAction
	zoom: Scroll1DAction
	pan: Scroll2DAction
	hover: HoverAction
}

const cfg: InterfaceConfigurations<GameXActions> = {
	select: [
		{
			type: 'click',
			modifiers: modKeyCombination.none,
			button: MouseButton.left,
		},
	],
	zoom: [
		{
			type: 'wheelY',
			modifiers: modKeyCombination.none,
		},
	],
	pan: [
		{
			type: 'wheels',
			modifiers: modKeyCombination.ctrl,
		},
	],
	hover: [
		{
			type: 'hover',
			buttons: MouseButtons.none,
			modifiers: modKeyCombination.none,
		},
	],
}

const evt: InterfaceEvents<GameXActions> = {
	select(evt) {},
	activate(evt) {},
	zoom(evt) {},
	pan(evt) {},
	hover(evt) {},
}

const im = new InputMode<GameXActions>(
	handledActions(TileHandle)({
		select(target, event) {},
	}),
	pointActions({
		zoom(target, event) {},
	})
)

// #endregion
