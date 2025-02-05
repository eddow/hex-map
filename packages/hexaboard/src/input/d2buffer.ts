import type { Vector2Like } from 'three'
/**
 * This is a standalone library to provide Mouse/Keyboard-Events a proper way to animated game
 */
import { complete } from '~/utils'
import { type ModKeyCombination, MouseButtons, mckFrom, modKeyCombination } from './types'

export const preventDefaultEvents = new Set(['contextmenu'])
export const keyboardEvents = ['keydown', 'keyup', 'keypress']

// One mouse for the computer, these ought to be global
let buttonsState: MouseButtons = MouseButtons.none
let modifierKeys: ModKeyCombination = modKeyCombination.none
let mousePosition: Vector2Like = { x: 0, y: 0 }
const keysDown: Record<string, boolean> = {}

export interface MouseState {
	buttons: MouseButtons
	position: Vector2Like
}

export interface InputSnapshot {
	mouse?: MouseState
	previous?: MouseState
	modifiers: ModKeyCombination
	deltaMouse?: Vector2Like
	deltaWheel?: Vector2Like
	keysDown: Record<string, boolean>
}

/**
 * Buffers the events and check them all at render time
 * - cumulate all the move/wheel events into one
 * - allows keyboard events on canvas, who receive focus on mouse-* events
 * - self-manage clicks & dbl-clicks to allow any button to be used
 */
export class D2Buffer {
	public static doubleClickTimeout = 300
	private lastClick: number[] = []
	private eventsQueue: (MouseEvent | KeyboardEvent)[] = []

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
	public forwardedEvents = new Set<string>(['keydown', 'mouseleave'])
	private canvas2substitute = new Map<HTMLElement, HTMLElement>()
	private substitute2canvas = new Map<HTMLElement, HTMLElement>()
	public previousButtons: MouseButtons = MouseButtons.none
	public lastButtonChange?: Vector2Like
	private mouseOut = true
	get buttons() {
		return buttonsState
	}
	get modifiers() {
		return modifierKeys
	}
	get mousePosition() {
		return mousePosition
	}
	public mouseState?: MouseState
	public deltaPosition?: Vector2Like
	public deltaWheel?: Vector2Like

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

	/*************  ✨ Codeium Command ⭐  *************/
	/**
	 * Removes the event listeners registered to the given element
	 * @param element - the element to stop listening to
	 */
	/******  7a4ca02d-1c7c-458b-92f5-a30e4dfdfe25  *******/
	public unListenTo(element: HTMLElement) {
		this.removeListeners(element, this.managedEvents)
	}

	public get activeElement() {
		const element = document.activeElement as HTMLElement
		const canvas = this.substitute2canvas.get(element)
		return canvas ?? (this.canvas2substitute.has(element) ? element : undefined)
	}

	public get size() {
		return this.eventsQueue.length
	}

	public snapshot(): InputSnapshot {
		const previous = this.mouseState
		this.mouseState = this.mouseOut ? undefined : { buttons: buttonsState, position: mousePosition }
		try {
			return {
				mouse: this.mouseState,
				previous,
				modifiers: modifierKeys,
				deltaMouse: this.deltaPosition,
				deltaWheel: this.deltaWheel,
				keysDown,
			}
		} finally {
			this.deltaPosition = undefined
			this.deltaWheel = undefined
		}
	}

	public *events() {
		const rv = this.eventsQueue
		this.eventsQueue = []
		yield* rv
	}
	// #region Lambdas

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
		event.stopPropagation()
		event.preventDefault()
		const canvas = this.substitute2canvas.get(event.target as HTMLElement)
		if (canvas && this.managedEvents.has(event.type)) {
			// @ts-expect-error
			const newEvent = new event.constructor(event.type, event)
			canvas.dispatchEvent(newEvent)
		}
	}
	private pushEvent = (rawEvent: Event) => {
		const event = rawEvent as MouseEvent | KeyboardEvent
		if (event instanceof MouseEvent) this.focusOnEnter(event)
		/*if (preventDefaultEvents.has(event.type))*/ event.preventDefault()
		event.stopPropagation()
		if ('buttons' in event && event.buttons !== buttonsState) buttonsState = event.buttons
		if ('shiftKey' in event) modifierKeys = mckFrom(event)

		if (
			this.forwardedEvents.has(event.type) &&
			(!(event instanceof KeyboardEvent) || !event.repeat)
		)
			this.eventsQueue.push(event)

		if (event instanceof MouseEvent) {
			this.mouseOut = event.type === 'mouseleave'
			switch (event.type) {
				case 'mousedown':
					{
						const now = Date.now()
						const click = new MouseEvent('click', event)
						event.target!.dispatchEvent(click)
						this.eventsQueue.push(click)
						if (now - this.lastClick[event.button] < D2Buffer.doubleClickTimeout) {
							const dblclick = new MouseEvent('dblclick', event)
							event.target!.dispatchEvent(dblclick)
							this.eventsQueue.push(dblclick)
							this.lastClick[event.button] = 0
						} else this.lastClick[event.button] = now
						this.lastButtonChange = { x: event.offsetX, y: event.offsetY }
					}
					break
				case 'mouseup':
					this.lastButtonChange = { x: event.offsetX, y: event.offsetY }
					break
				case 'mousemove':
					{
						mousePosition = { x: event.offsetX, y: event.offsetY }
						const { x, y } = this.deltaPosition ?? { x: 0, y: 0 }
						this.deltaPosition = { x: event.movementX + x, y: event.movementY + y }
						//this.potentialClick = false
					}
					break
				case 'wheel':
					{
						complete<WheelEvent>(event)
						const { x, y } = this.deltaWheel ?? { x: 0, y: 0 }
						this.deltaWheel = { x: event.deltaX / 96 + x, y: event.deltaY / 120 + y }
					}
					break
			}
		} else if (event instanceof KeyboardEvent) {
			switch (event.type) {
				case 'keydown':
					keysDown[event.code] = true
					break
				case 'keyup':
					keysDown[event.code] = false
					break
			}
		}
	}

	// #endregion
}
