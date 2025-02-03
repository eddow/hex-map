import { complete } from '~/utils'
import { type ModKeyCombination, MouseButtons, modKeyCombination, modKeys } from './types'

export const preventDefaultEvents = new Set(['contextmenu'])
export const keyboardEvents = ['keydown', 'keyup', 'keypress']

// One mouse for the computer, these ought to be global
let buttonsState: MouseButtons = MouseButtons.none
let modifierKeys: ModKeyCombination = modKeyCombination.none
let mousePosition: { x: number; y: number } | undefined = undefined

/**
 * Buffers the events and check them all at render time
 * - cumulate all the move/wheel events into one
 * - allows keyboard events on canvas, who receive focus on mouse-* events
 */
export class D2Buffer {
	private events: (MouseEvent | KeyboardEvent)[] = []

	public managedEvents = new Set<string>([
		'mousemove',
		'wheel',
		'mousedown',
		'mouseup',
		'mouseleave',
		'contextmenu',
		'keydown',
		'keyup',
	])
	private canvas2substitute = new Map<HTMLElement, HTMLElement>()
	private substitute2canvas = new Map<HTMLElement, HTMLElement>()
	private movement?: MouseEvent
	private wheel?: WheelEvent
	public previousButtons: MouseButtons = MouseButtons.none
	get buttons() {
		return buttonsState
	}
	get modifiers() {
		return modifierKeys
	}
	get mousePosition() {
		return mousePosition
	}
	private removeListeners(element: HTMLElement, managedEvents: Iterable<string>) {
		for (const event of managedEvents) element.removeEventListener(event, this.pushEvent)
		element.removeEventListener('mouseenter', this.focusOnEnter)
		const substitute = this.canvas2substitute.get(element)
		if (substitute) {
			substitute.remove()
			this.substitute2canvas.delete(substitute)
			this.canvas2substitute.delete(element)
		}
	}
	public listenTo(element: HTMLElement) {
		const managedEvents = [...this.managedEvents]
		for (const event of managedEvents) element.addEventListener(event, this.pushEvent)
		if (!this.managedEvents.has('mouseenter'))
			element.addEventListener('mouseenter', this.focusOnEnter)

		return () => this.removeListeners(element, managedEvents)
	}

	public unListenTo(element: HTMLElement) {
		this.removeListeners(element, this.managedEvents)
	}

	public get size() {
		return this.events.length + (this.movement ? 1 : 0) + (this.wheel ? 1 : 0)
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
		this.previousButtons = buttonsState
	}

	private focusOnEnter = (event: Event) => {
		const target = event.target as HTMLElement
		let substitute = this.canvas2substitute.get(target)
		const focus = substitute ?? target
		if (document.activeElement !== focus) focus.focus()
		if (document.activeElement !== target && !substitute) {
			substitute = document.createElement('a')
			substitute.style.position = 'absolute'
			substitute.style.left = '-1000px'
			substitute.style.top = '-1000px'
			substitute.style.opacity = '0'
			substitute.tabIndex = -1
			this.substitute2canvas.set(substitute, target)
			this.canvas2substitute.set(target, substitute)
			document.body.appendChild(substitute)
			//htmlTarget.after(substitute)
			for (const keyEvent of keyboardEvents)
				substitute.addEventListener(keyEvent as KeyboardEvent['type'], this.forwardEvent)
			substitute.focus()
		}
	}
	forwardEvent = (event: Event) => {
		const canvas = this.substitute2canvas.get(event.target as HTMLElement)
		if (canvas && this.managedEvents.has(event.type)) {
			// @ts-expect-error
			const newEvent = new event.constructor(event.type, event)
			canvas.dispatchEvent(newEvent)
		}
	}
	// Has to be an arrow function to be called without context
	private pushEvent = (rawEvent: Event) => {
		const event = rawEvent as MouseEvent | KeyboardEvent
		if (event instanceof MouseEvent) this.focusOnEnter(event)
		if (preventDefaultEvents.has(event.type)) event.preventDefault()
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
		} else if (!(event instanceof KeyboardEvent) || !event.repeat) this.events.push(event)
	}
}
