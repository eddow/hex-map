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
	mousePosition: MousePosition
	intersection?: Intersection
	handle: Handle
}

interface MouseControlledEvolution<Handle extends MouseHandle | undefined = MouseHandle | undefined>
	extends PositionedMouseEvolution<Handle> {
	modKeyCombination: ModKeyCombination
}

export interface MouseButtonEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'click' | 'up' | 'down' | 'dblClick'
	button: MouseButton
	buttons: MouseButtons
}

export interface MouseDrag {
	handle: MouseHandle | undefined
	button: MouseButton
	dropValidation?: (drag: MouseDrag, target: Eventful<MouseEvents>) => boolean
	cancel: (evolution: MouseDragEvolution) => void
	dragDrop: (evolution: MouseDragEvolution) => void
	over: (evolution: MouseDragEvolution) => void
}

export function mouseDrag(button: MouseButton): MouseDrag {
	return {
		handle: null!, // `will be filled by evolutions` generator
		button,
		cancel(evolution) {
			evolution.handle?.target?.emit(
				'mouse:dragCancel',
				evolution as MouseDragEvolution<MouseHandle>
			)
		},
		dragDrop(evolution) {
			evolution.handle?.target?.emit('mouse:dragDrop', evolution as MouseDragEvolution<MouseHandle>)
		},
		over(evolution) {
			evolution.handle?.target?.emit('mouse:dragOver', evolution as MouseDragEvolution<MouseHandle>)
		},
	}
}

export interface MouseDragEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends MouseControlledEvolution<Handle> {
	type: 'startDrag' | 'dragCancel' | 'dragOver' | 'dragDrop'
	drag: MouseDrag
}

export interface MouseHoverEvolution<
	Handle extends MouseHandle | undefined = MouseHandle | undefined,
> extends PositionedMouseEvolution<Handle> {
	type: 'enter' | 'leave' | 'hover'
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
	'mouse:dblClick': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:up': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:down': (evolution: MouseButtonEvolution<Handle>) => void
	'mouse:startDrag': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragCancel': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragOver': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:dragDrop': (evolution: MouseDragEvolution<Handle>) => void
	'mouse:enter': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:hover': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:leave': (evolution: MouseHoverEvolution<Handle>) => void
	'mouse:wheel': (evolution: MouseWheelEvolution<Handle>) => void
}

export type MouseEvents = HandledMouseEvents<MouseHandle | undefined> & {
	'mouse:lock': (evolution: MouseLockingEvolution) => void
	'mouse:unlock': (evolution: MouseLockingEvolution) => void
}

export type MouseHandler<Handle extends MouseHandle | undefined = MouseHandle | undefined> = (
	sender: MouseControl,
	target: Eventful<MouseEvents>,
	intersection: Intersection<Object3D<Object3DEventMap>>
) => Handle | undefined

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
	Back = 3,
	Forward = 4,
}
export enum MouseButtons {
	Left = 1,
	Right = 2,
	Middle = 4,
	Back = 8,
	Forward = 16,
}
export const modKeys = ['shift', 'alt', 'ctrl'] as const
export type ModKey = (typeof modKeys)[number]
export type ModKeyCombination = Partial<Record<ModKey, boolean>>
export const modKeysComb = {
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
