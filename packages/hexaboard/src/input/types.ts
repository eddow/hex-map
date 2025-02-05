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

export type EventModKeyCombination = { altKey: boolean; ctrlKey: boolean; shiftKey: boolean }
export type ModKeyCombination = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export function mckFrom(eMCK: EventModKeyCombination): ModKeyCombination {
	return ((eMCK.altKey ? 1 : 0) +
		(eMCK.ctrlKey ? 2 : 0) +
		(eMCK.shiftKey ? 4 : 0)) as ModKeyCombination
}
export const modKeyCombination = {
	none: mckFrom({ altKey: false, ctrlKey: false, shiftKey: false }),
	alt: mckFrom({ altKey: true, ctrlKey: false, shiftKey: false }),
	ctrl: mckFrom({ altKey: false, ctrlKey: true, shiftKey: false }),
	shift: mckFrom({ altKey: false, ctrlKey: false, shiftKey: true }),
	altShift: mckFrom({ altKey: true, ctrlKey: false, shiftKey: true }),
	altCtrl: mckFrom({ altKey: true, ctrlKey: true, shiftKey: false }),
	shiftCtrl: mckFrom({ altKey: false, ctrlKey: true, shiftKey: true }),
	altShiftCtrl: mckFrom({ altKey: true, ctrlKey: true, shiftKey: true }),
}
