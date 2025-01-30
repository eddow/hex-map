import { Raycaster, Scene, Vector2, Vector3 } from 'three'
import type { GameView } from '~/game/game'
import { Eventful } from '../utils/events'
import { LockSemaphore } from './lockSemaphore'
import {
	type ButtonsCombination,
	type HandledMouseEvents,
	type ModKeyCombination,
	type MouseButtonEvolution,
	type MouseButtons,
	type MouseDragEvolution,
	type MouseDragHandle,
	type MouseEvents,
	type MouseEvolution,
	type MouseHandle,
	type MouseHoverEvolution,
	type MouseLockButtons,
	type MouseMoveEvolution,
	type MousePosition,
	type MouseReactive,
	type MouseWheelEvolution,
	type MouseZoomEvolution,
	type PositionedMouseEvolution,
	modKeys,
	modKeysComb,
	mouseConfig,
} from './types'

function isModKeyCombination(e: MouseEvent, c: ModKeyCombination) {
	return modKeys.every((mod) => e[`${mod}Key` as keyof MouseEvent] === c[mod])
}
// Use browse/compare in order to have the reference who can be compared with ===
function modKeysCombinations(e: MouseEvent) {
	for (const c in modKeysComb) if (isModKeyCombination(e, modKeysComb[c])) return modKeysComb[c]
	throw new Error('mod keys combination not found')
}
function isCombination(e: MouseEvent, c: ButtonsCombination) {
	return e.buttons === c.buttons && isModKeyCombination(e, c.modifiers)
}

const mouseListeners: unique symbol = Symbol('Mouse events')
interface MouseEventsView extends GameView {
	[mouseListeners]: Record<string, (event: any) => void>
}

export class MouseControl extends Eventful<MouseEvents> {
	public views = new Map<HTMLCanvasElement, GameView>()
	public readonly scene = new Scene()
	private hovered?: GameView
	private hoveredHandle?: MouseHandle
	private lastButtonDown?: MouseButtonEvolution<MouseHandle | undefined>
	private dragStartHandle?: MouseDragHandle
	private lastEvolutions: MouseEvolution[] = []

	constructor(private clampCamZ: { min: number; max: number }) {
		super()
		this.scene.matrixWorldAutoUpdate = false
	}

	get lastEvolution(): MouseEvolution | undefined {
		return this.lastEvolutions[this.lastEvolutions.length - 1]
	}
	evolve<Evolution extends MouseEvolution>(evolution: Omit<Evolution, 'gameView'>) {
		this.lastEvolutions.push({ ...evolution, gameView: this.hovered ?? this.lockedGV! })
	}

	*evolutions() {
		// Used to cache position->handle in order to avoid casting intersections when not needed
		let lastPosition: MousePosition | undefined
		let lastHandle: MouseHandle | undefined

		const rv = this.lastEvolutions
		this.lastEvolutions = []
		for (const e of rv) {
			const eP = e as PositionedMouseEvolution<MouseHandle | undefined>
			if ('position' in eP) {
				if (lastPosition?.x === eP.position?.x && lastPosition?.y === eP.position?.y)
					eP.handle = lastHandle
				else if (eP.position) {
					lastPosition = eP.position
					lastHandle = eP.handle = this.mouseInteract(eP)?.handle
				} else {
					lastHandle = undefined
					lastPosition = undefined
				}
			}
			yield e
			// These evolutions invalidate the cached position/handle
			if (['leave', 'lock'].includes(e.type)) lastHandle = lastPosition = undefined
			if (
				!!this.hoveredHandle !== !!lastHandle ||
				(this.hoveredHandle && lastHandle && !this.hoveredHandle.equals(lastHandle))
			) {
				if (this.hoveredHandle)
					yield {
						type: 'leave',
						position: eP.position,
						gameView: this.hovered,
						handle: this.hoveredHandle,
					}
				this.hoveredHandle = lastHandle
				if (this.hoveredHandle)
					yield {
						type: 'enter',
						position: eP.position,
						gameView: this.hovered,
						handle: this.hoveredHandle,
					}
				yield {
					type: 'hover',
					position: eP.position,
					gameView: this.hovered,
					handle: this.hoveredHandle,
				}
			}
		}
	}

	raiseEvents() {
		for (const e of this.evolutions()) {
			this.emit(`mouse:${e.type}` as keyof MouseEvents, e as any)
			if ('handle' in e && e.handle)
				e.handle.target.emit(`mouse:${e.type}` as keyof HandledMouseEvents, e as any)
		}
	}

	// #region Event listeners book-keeping
	listenTo(gameView: GameView) {
		const canvas = gameView.canvas
		const events = {
			mousemove: (e: MouseEvent) => this.mouseMove(e),
			mousedown: (e: MouseEvent) => this.mouseDown(e),
			mouseup: (e: MouseEvent) => this.mouseUp(e),
			contextmenu: (e: MouseEvent) => this.contextMenu(e),
			wheel: (e: WheelEvent) => this.mouseWheel(e),
			mouseenter: (e: MouseEvent) => this.mouseEnter(e),
			mouseleave: (e: MouseEvent) => this.mouseLeave(e),
		} as Record<string, (event: any) => void>
		for (const eventType in events) canvas.addEventListener(eventType, events[eventType])
		;(gameView as MouseEventsView)[mouseListeners] = events
		this.views.set(canvas, gameView)
	}
	disengage(gameView: GameView) {
		const canvas = gameView.canvas
		const events = (gameView as MouseEventsView)[mouseListeners]
		for (const eventType in events) canvas.removeEventListener(eventType, events[eventType])
		this.views.delete(canvas)
	}

	disengageAll() {
		for (const gameView of this.views.values()) this.disengage(gameView)
	}

	// #endregion
	// #region Mouse Interactions

	private readonly rayCaster = new Raycaster()
	mouseIntersections(gameView: GameView, position: MousePosition) {
		const { canvas, camera } = gameView
		const mouse = new Vector2(
			(position.x / canvas.clientWidth) * 2 - 1,
			-(position.y / canvas.clientHeight) * 2 + 1
		)
		this.rayCaster.setFromCamera(mouse, camera)

		return this.rayCaster.intersectObjects(this.scene.children)
	}
	mouseInteract({ gameView, position }: PositionedMouseEvolution) {
		const intersections = this.mouseIntersections(gameView, position).filter(
			(i) =>
				i.object?.userData?.mouseHandler?.mouseHandle &&
				this.dragStartHandle?.dropValidation?.(i.object?.userData?.mouseHandler) !== false
		)
		for (const intersection of intersections) {
			const userData = intersection.object.userData
			const target = userData.mouseHandler as MouseReactive
			const handle = target.mouseHandle(this, userData.mouseTarget, intersection)
			if (handle)
				return {
					intersection: intersection,
					handle,
				}
		}
	}

	private lockedGV: GameView | null = null
	private lockSemaphore = new LockSemaphore((locked) => {
		const shouldLock = (locked instanceof HTMLCanvasElement && this.views.get(locked)) || null
		this.lockSemaphore.log('mainCB', !!this.lockedGV, !!shouldLock)
		if (!!this.lockedGV !== !!shouldLock) {
			if (this.lockedGV) {
				this.hovered = this.lockedGV
				this.evolve({ type: 'unlock' })
				this.lockedGV = null
				if (this.lastCursorEvolution) this.evolve(this.lastCursorEvolution)
			} else {
				this.hovered = undefined
				this.lockedGV = shouldLock
				this.evolve({ type: 'lock' })
				if (this.hoveredHandle)
					this.evolve<MouseHoverEvolution>({
						type: 'leave',
						position: { x: 0, y: 0 },
						handle: this.hoveredHandle,
					})
			}
		}
	})
	private reLock(event: MouseEvent) {
		const shouldLock = Object.values(mouseConfig.lockButtons).some((c) => isCombination(event, c))
		if (!!this.lockSemaphore.locked !== shouldLock)
			this.lockSemaphore.lock(shouldLock ? (event.target as Element) : null)
		return shouldLock
	}

	private moveCamera(event: MouseEvent, gameView: GameView) {
		const { camera } = gameView
		// Relative mouse movement
		const { dx, dy } = { dx: event.movementX, dy: event.movementY } // Relative mouse event
		let movement: undefined | keyof MouseLockButtons
		for (const key in mouseConfig.lockButtons) {
			const comb = mouseConfig.lockButtons[key as keyof MouseLockButtons]
			if (comb && isCombination(event, comb)) {
				movement = key as keyof MouseLockButtons
				break
			}
		}
		switch (movement) {
			case 'turn': {
				// Rotate camera
				// x: movement rotates the camera around the word's Z axis
				camera.rotateOnWorldAxis(new Vector3(0, 0, -1), dx * 0.01)
				// y: camera tilts between horizontal (plan: z=0) and vertical (look along Z axis) positions
				camera.rotateX(-dy * 0.01) // Apply tilt rotation
				// clamp down/horizon
				const upVector = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
				if (upVector.z < 0) camera.rotateX(-Math.asin(upVector.z))
				const frontVector = new Vector3(0, 0, 1).applyQuaternion(camera.quaternion)
				// clamp to "nearly horizontal"
				if (frontVector.z < 0.1) camera.rotateX(Math.asin(frontVector.z - 0.1))
				break
			}
			case 'pan': {
				const displacement = camera.position.z / 1000
				const xv = new Vector3(1, 0, 0)
				xv.applyQuaternion(camera.quaternion)
				const upVector = new Vector3(0, 1, 0)
				const worldUpVector = upVector.applyQuaternion(camera.quaternion)

				const projectedUp = new Vector3(worldUpVector.x, worldUpVector.y, 0)

				// Step 3: Normalize the vector
				projectedUp.normalize()

				// Step 4: Scale it to match the original magnitude
				const originalMagnitude = worldUpVector.length()
				projectedUp.multiplyScalar(originalMagnitude)
				// Pan camera
				camera.position
					.add(xv.multiplyScalar(-dx * displacement))
					.add(projectedUp.multiplyScalar(dy * displacement))
				break
			}
			case 'lookAt': {
				/*
			TODO: Take the look-at point (at least x/y) at mousedown event
				const lookAt = this.hoveredHandle?.position.clone() || camera.position.clone()
				// Rotate camera
				// x: movement rotates the camera around the word's Z axis
				camera.position
					.copy(lookAt)
					.add(new Vector3(dx * displacement, -dy * displacement, 0))
					.sub(lookAt)
					.normalize()
					.multiplyScalar(camera.position.distanceTo(lookAt))
				camera.lookAt(lookAt)*/
			}
		}
	}

	private lastCursorEvolution?: MouseMoveEvolution
	private moveCursor(event: MouseEvent) {
		this.hovered =
			(event.target instanceof HTMLCanvasElement && this.views.get(event.target)) || undefined
		if (this.hovered && !!event.buttons && !this.dragStartHandle && this.lastButtonDown) {
			this.dragStartHandle = this.mouseInteract(this.lastButtonDown!)?.handle
			if (this.dragStartHandle) {
				this.evolve<MouseDragEvolution>({
					...this.lastButtonDown,
					type: 'dragStart',
					dragStartHandle: this.dragStartHandle,
				})
			} else this.lastButtonDown = undefined
		}
		if (this.lastEvolution?.type === 'move') this.lastEvolutions.pop()
		const evolution = {
			type: 'move',
			gameView: this.hovered,
			...(this.hovered
				? {
						buttons: event.buttons,
						modKeyCombination: modKeysCombinations(event),
						position: {
							x: event.offsetX,
							y: event.offsetY,
						},
					}
				: {
						buttons: 0,
						modKeyCombination: modKeysComb.none,
						position: null,
					}),
		} as MouseMoveEvolution
		this.lastCursorEvolution = evolution
		this.evolve(evolution)
		if (this.dragStartHandle) {
			this.evolve<MouseDragEvolution>({
				...this.lastButtonDown!,
				...evolution,
				type: 'dragOver',
				dragStartHandle: this.dragStartHandle,
			})
		}
	}

	// #endregion
	// #region Events

	private mouseMove(event: MouseEvent) {
		//this.lockSemaphore.callWhenLocked(() => {
		if (this.lockedGV) this.moveCamera(event, this.lockedGV)
		else this.moveCursor(event)
		//})
	}
	private mouseDown(event: MouseEvent) {
		event.preventDefault()
		this.dragStartHandle = undefined
		if (this.reLock(event)) this.lastButtonDown = undefined
		else {
			this.lastButtonDown = {
				type: 'down',
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				gameView: this.hovered!,
				position: { x: event.offsetX, y: event.offsetY },
			} as MouseButtonEvolution
			this.evolve(this.lastButtonDown)
		}
	}

	private mouseUp(event: MouseEvent) {
		event.preventDefault()
		if (event.buttons === 0 && this.lastButtonDown?.button === event.button)
			this.evolve<MouseButtonEvolution>({
				type: 'click',
				button: event.button,
				buttons: event.buttons as MouseButtons,
				modKeyCombination: modKeysCombinations(event),
				position: { x: event.offsetX, y: event.offsetY },
				handle: undefined,
			})
		this.lastButtonDown = undefined
		if (this.dragStartHandle) {
			this.evolve<MouseDragEvolution>({
				type: 'dragEnd',
				dragStartHandle: this.dragStartHandle,
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				position: { x: event.offsetX, y: event.offsetY },
				handle: undefined,
			})
		}
		this.dragStartHandle = undefined
		this.evolve<MouseButtonEvolution>({
			type: 'up',
			button: event.button,
			buttons: event.buttons as MouseButtons,
			modKeyCombination: modKeysCombinations(event),
			position: { x: event.offsetX, y: event.offsetY },
			handle: undefined,
		})
		this.reLock(event)
	}
	private contextMenu(event: Event) {
		event.preventDefault()
	}
	private mouseWheel(event: WheelEvent) {
		const delta = { x: event.deltaX / 96, y: event.deltaY / 120 }

		for (const axis of ['x', 'y'] as const)
			if (delta[axis] && this.hovered) {
				if (
					mouseConfig.zoomWheel.axis === axis &&
					isModKeyCombination(event, mouseConfig.zoomWheel.modifiers)
				) {
					const position = { x: event.offsetX, y: event.offsetY }
					const center = this.mouseIntersections(this.hovered!, position)[0]
					this.evolve<MouseZoomEvolution>({
						type: 'zoom',
						position,
						handle: undefined,
					})
					const camera = this.hovered!.camera
					if (center) {
						const dist = camera.position.clone().sub(center.point)
						dist.multiplyScalar(mouseConfig.zoomSpeed ** delta[axis])
						camera.position.copy(center.point).add(dist)
						if (camera.position.z > this.clampCamZ.max) camera.position.z = this.clampCamZ.max
						else if (camera.position.z < this.clampCamZ.min) camera.position.z = this.clampCamZ.min
					}
				} else
					this.evolve<MouseWheelEvolution>({
						type: 'wheel',
						position: { x: event.offsetX, y: event.offsetY },
						axis,
						modKeyCombination: modKeysCombinations(event),
						delta: delta[axis],
						handle: undefined,
					})
			}
	}

	private mouseEnter(event: MouseEvent) {}
	private mouseLeave(event: MouseEvent) {
		if (this.hoveredHandle) {
			this.evolve<MouseHoverEvolution>({
				type: 'leave',
				position: {
					x: event.offsetX,
					y: event.offsetY,
				},
				handle: this.hoveredHandle,
			})
			this.hoveredHandle = undefined
		}
	}

	// #endregion
}
