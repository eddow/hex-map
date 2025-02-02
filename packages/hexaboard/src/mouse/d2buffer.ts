import { complete } from '~/utils'
import { type ModKeyCombination, MouseButtons, modKeyCombination, modKeys } from './types'

// One mouse for the computer, these ought to be global
let buttonsState: MouseButtons = MouseButtons.none
let modifierKeys: ModKeyCombination = modKeyCombination.none
let mousePosition: { x: number; y: number } | undefined = undefined
export class D2Buffer {
	private events: (MouseEvent | KeyboardEvent)[] = []

	public managedEvents: string[] = [
		'mousemove',
		'wheel',
		'mousedown',
		'mouseup',
		'mouseleave',
		'click',
		'dblclick',
		'contextmenu',
		'keydown',
		'keyup',
		'keypress',
	]
	private movement?: MouseEvent
	private wheel?: WheelEvent

	get buttons() {
		return buttonsState
	}
	get modifiers() {
		return modifierKeys
	}
	get mousePosition() {
		return mousePosition
	}
	public listen(element: HTMLElement) {
		const managedEvents = [...this.managedEvents]
		for (const event of managedEvents) element.addEventListener(event, this.pushEvent)

		return () => {
			for (const event of managedEvents) element.removeEventListener(event, this.pushEvent)
		}
	}

	public unlisten(element: HTMLElement) {
		for (const event of this.managedEvents) element.removeEventListener(event, this.pushEvent)
	}

	public get size() {
		return this.events.length
	}

	public *d2events() {
		const rv = this.events
		this.events = []
		if (this.movement) {
			yield this.movement
			this.movement = undefined
		}
		if (this.wheel) {
			yield this.wheel
			this.wheel = undefined
		}
		yield* rv
	}

	// Has to be an arrow function to be called without context
	private pushEvent = (event: Event) => {
		event.preventDefault()
		complete<MouseEvent | KeyboardEvent>(event)
		if ('buttons' in event && event.buttons !== buttonsState) buttonsState = event.buttons
		if ('shiftKey' in event)
			modifierKeys = Object.fromEntries(
				modKeys.map((mod) => [mod, event[`${mod}Key` as 'shiftKey' | 'ctrlKey' | 'altKey']])
			) as ModKeyCombination
		if (event.type === 'mousemove') {
			complete<MouseEvent>(event)
			const { movementX, movementY } = this.movement ?? { movementX: 0, movementY: 0 }
			this.movement = new MouseEvent('mousemove', {
				...event,
				movementX: event.movementX + movementX,
				movementY: event.movementY + movementY,
			})
			mousePosition = { x: event.offsetX, y: event.offsetX }
		} else if (event.type === 'wheel') {
			complete<WheelEvent>(event)
			const { deltaX, deltaY } = this.wheel ?? { deltaX: 0, deltaY: 0 }
			this.wheel = new WheelEvent('wheel', {
				...event,
				deltaX: event.deltaX + deltaX,
				deltaY: event.deltaY + deltaY,
			})
		} else this.events.push(event)
	}
}
