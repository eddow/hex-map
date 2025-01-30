// #region Evolutions

import type { Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game, GameView } from '~/game'
import type { Eventful } from '~/utils'
import type { MouseControl } from '.'

export interface MouseEvolution {
	type: string
	gameView: GameView
}

export interface MouseLockingEvolution extends MouseEvolution {
	type: 'lock' | 'unlock'
}

export interface MousePosition {
	x: number
	y: number
}

export interface PositionedMouseEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseEvolution {
	position: MousePosition
	handle: Handle
}

interface MouseControlledEvolution<Handle extends MouseHandle | undefined = MouseHandle | undefined>
	extends PositionedMouseEvolution<Handle> {
	modKeyCombination: ModKeyCombination
}

export interface MouseButtonEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'click' | 'up' | 'down'
	button: MouseButton
	buttons: MouseButtons
}

export interface MouseDragHandle extends MouseHandle {
	dropValidation?: (target: any) => boolean
}

export interface MouseDragEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'dragStart' | 'dragEnd' | 'dragOver'
	dragStartHandle: MouseDragHandle
	button: MouseButton
}

export interface MouseHoverEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends PositionedMouseEvolution<Handle> {
	type: 'enter' | 'leave' | 'hover'
}

export interface MouseZoomEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends PositionedMouseEvolution<Handle> {
	type: 'zoom'
}

export interface MouseMoveEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'move'
	buttons: MouseButtons
}

export interface MouseWheelEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'wheel'
	axis: 'x' | 'y'
	delta: number
}

// #endregion

export type HandledMouseEvents<Handle extends MouseHandle | undefined = MouseHandle> = {
	'mouse:move': (evolution: MouseMoveEvolution<Handle>) => void
	'mouse:click': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:up': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:down': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:dragStart': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragEnd': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragOver': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:enter': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:hover': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:leave': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:wheel': (evolution: MouseWheelEvolution<Handle>) => void
}

export type MouseEvents = HandledMouseEvents<MouseHandle | undefined> & {
	'mouse:lock': (evolution: MouseLockingEvolution) => void
	'mouse:unlock': (evolution: MouseLockingEvolution) => void
}

export interface MouseReactive<Handle extends MouseHandle | undefined = MouseHandle | undefined> {
	mouseHandle(
		sender: MouseControl,
		target: Eventful<MouseEvents>,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): Handle
}

export abstract class MouseHandle {
	constructor(
		public readonly game: Game,
		public readonly target: Eventful<HandledMouseEvents>
	) {}
	get land() {
		return this.game.land
	}
	abstract equals(other: MouseHandle): boolean
}

export enum MouseButton {
	Left = 0,
	Middle = 1,
	Right = 2,
}
export enum MouseButtons {
	Left = 1,
	Right = 2,
	Middle = 4,
	th4 = 8,
	th5 = 16,
}
export const modKeys = ['shift', 'alt', 'ctrl'] as const
export type ModKey = (typeof modKeys)[number]
export type ModKeyCombination = Record<ModKey, boolean>
export const modKeysComb: Record<string, ModKeyCombination> = {
	none: { alt: false, ctrl: false, shift: false },
	alt: { alt: true, ctrl: false, shift: false },
	ctrl: { alt: false, ctrl: true, shift: false },
	shift: { alt: false, ctrl: false, shift: true },
	altShift: { alt: true, ctrl: false, shift: true },
	altCtrl: { alt: true, ctrl: true, shift: false },
	shiftCtrl: { alt: false, ctrl: true, shift: true },
	altShiftCtrl: { alt: true, ctrl: true, shift: true },
}

export type ButtonsCombination = {
	buttons: MouseButtons
	modifiers: ModKeyCombination
}
export type WheelCombination = {
	axis: 'x' | 'y'
	modifiers: ModKeyCombination
}
export interface MouseLockButtons {
	pan?: ButtonsCombination
	turn?: ButtonsCombination
	lookAt?: ButtonsCombination
}

export interface MouseConfig {
	lockButtons: MouseLockButtons
	zoomWheel: WheelCombination
	zoomSpeed: number
}
export const mouseConfig: MouseConfig = {
	lockButtons: {
		pan: { buttons: MouseButtons.Right | MouseButtons.Left, modifiers: modKeysComb.none },
		turn: { buttons: MouseButtons.Middle, modifiers: modKeysComb.none },
		//lookAt: { buttons: MouseButtons.Right, modifiers: modKeysComb.none },
	},
	zoomWheel: { axis: 'y', modifiers: modKeysComb.none },
	zoomSpeed: 1.2,
}
