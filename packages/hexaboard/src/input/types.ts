// TODO, finish this file (kill it)
import type { Intersection, Object3D, Object3DEventMap } from 'three'

export type MouseHandler<Handle extends MouseHandle | undefined = MouseHandle | undefined> = (
	intersection: Intersection<Object3D<Object3DEventMap>>
) => Handle | undefined

export abstract class MouseHandle {
	constructor(public readonly sender: any) {}
	abstract equals(other: MouseHandle): boolean
}

export enum MouseButton {
	left = 0,
	middle = 1,
	right = 2,
	rd3 = 3,
	th4 = 4,
}
export enum MouseButtons {
	none = 0,
	left = 1,
	right = 2,
	middle = 4,
	rd3 = 8,
	th4 = 16,
}
export type ModKeyCombination = { alt: boolean; ctrl: boolean; shift: boolean }
export const modKeyCombination = {
	none: { alt: false, ctrl: false, shift: false },
	alt: { alt: true, ctrl: false, shift: false },
	ctrl: { alt: false, ctrl: true, shift: false },
	shift: { alt: false, ctrl: false, shift: true },
	altShift: { alt: true, ctrl: false, shift: true },
	altCtrl: { alt: true, ctrl: true, shift: false },
	shiftCtrl: { alt: false, ctrl: true, shift: true },
	altShiftCtrl: { alt: true, ctrl: true, shift: true },
}
