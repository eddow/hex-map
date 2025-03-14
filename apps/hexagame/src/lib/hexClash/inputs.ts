import {
	type HoverAction,
	type InputActions,
	type InterfaceConfigurations,
	MouseButton,
	MouseButtons,
	type OneButtonAction,
	type Scroll1DAction,
	type Scroll2DAction,
	modKeyCombination,
} from 'hexaboard'

export interface HexClashActions extends InputActions {
	select: OneButtonAction
	zoom: Scroll1DAction
	pan: Scroll2DAction
	hover: HoverAction
}
export const inputsConfiguration: InterfaceConfigurations<HexClashActions> = {
	select: [
		{
			type: 'click',
			modifiers: modKeyCombination.none,
			button: MouseButton.left,
		},
		{
			type: 'keydown',
			modifiers: modKeyCombination.none,
			key: {
				code: 'Enter',
			},
		},
	],
	zoom: [
		{
			type: 'wheelY',
			modifiers: modKeyCombination.none,
		},
		{
			type: 'press2',
			modifiers: [{ on: modKeyCombination.none, use: { multiplier: 1 } }],
			multiplier: 0,
			keyNeg: {
				code: 'PageUp',
			},
			keyPos: {
				code: 'PageDown',
			},
		},
	],
	pan: [
		{
			type: 'delta',
			buttons: MouseButtons.left + MouseButtons.right,
			modifiers: modKeyCombination.none,
			invertX: false,
			invertY: false,
		},
		{
			type: 'press4',
			modifiers: [
				{ on: modKeyCombination.none, use: { multiplier: 1 } },
				{ on: modKeyCombination.shift, use: { multiplier: 2 } },
			],
			keyXNeg: {
				code: 'KeyD',
			},
			keyXPos: {
				code: 'KeyA',
			},
			keyYNeg: {
				code: 'KeyS',
			},
			keyYPos: {
				code: 'KeyW',
			},
		},
	],
	turn: [
		{
			type: 'delta',
			buttons: MouseButtons.middle,
			modifiers: modKeyCombination.none,
			invertX: false,
			invertY: false,
		},
	],
	hover: [
		{
			type: 'hover',
			buttonHoverType: true,
			keyModHoverType: false,
			buttons: [{ on: MouseButtons.none, use: { buttonHoverType: 'selectable' } }],
			modifiers: [{ on: modKeyCombination.none, use: { keyModHoverType: 'selectable' } }],
		},
	],
}
