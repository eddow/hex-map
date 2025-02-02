import { type Intersection, Raycaster, Scene, Vector2, Vector3 } from 'three'
import type { GameView } from '~/game/game'
import { complete } from '~/utils'
import { Eventful } from '../utils/events'
import { LockSemaphore } from './lockSemaphore'
import {
	type ButtonsCombination,
	type HandledMouseEvents,
	type ModKeyCombination,
	type MouseButtonEvolution,
	type MouseButtons,
	type MouseDrag,
	type MouseDragEvolution,
	type MouseEvents,
	type MouseEvolution,
	type MouseHandle,
	type MouseHandler,
	type MouseHoverEvolution,
	type MouseLockButtons,
	type MouseMoveEvolution,
	type MousePosition,
	type MouseWheelEvolution,
	type PositionedMouseEvolution,
	modKeys,
	modKeysComb,
	mouseConfig,
	mouseDrag,
} from './types'

function isModKeyCombination(e: MouseEvent, c: ModKeyCombination) {
	return modKeys.every((mod) => e[`${mod}Key` as keyof MouseEvent] === c[mod])
}
// Use browse/compare in order to have the reference who can be compared with ===
function modKeysCombinations(e: MouseEvent) {
	for (const c in modKeysComb)
		if (isModKeyCombination(e, modKeysComb[c as keyof typeof modKeysComb]))
			return modKeysComb[c as keyof typeof modKeysComb]
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
	private drag?: MouseDrag
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

	*evolutions(): Generator<MouseEvolution> {
		// Used to cache position->handle in order to avoid casting intersections when not needed
		let last:
			| {
					mousePosition: MousePosition
					handle?: MouseHandle
					intersection?: Intersection
			  }
			| undefined

		const rv = this.lastEvolutions
		this.lastEvolutions = []
		for (const e of rv) {
			const eP = e as PositionedMouseEvolution<MouseHandle | undefined>
			if ('mousePosition' in eP) {
				if (!eP.mousePosition) last = undefined
				else if (
					last?.mousePosition?.x !== eP.mousePosition?.x ||
					last?.mousePosition?.y !== eP.mousePosition?.y
				)
					last = {
						mousePosition: eP.mousePosition,
						...this.mouseInteract(eP),
					}
				if (last) {
					eP.handle = last.handle
					eP.intersection = last.intersection
				}
			}
			if (eP.type === 'startDrag') (eP as MouseDragEvolution).drag.handle = eP.handle
			yield e
			// These evolutions invalidate the cached position/handle
			if (['leave', 'lock'].includes(e.type)) last = undefined
			if (
				!!this.hoveredHandle !== !!last?.handle ||
				(this.hoveredHandle && last?.handle && !this.hoveredHandle.equals(last.handle))
			) {
				if (this.hoveredHandle)
					yield {
						type: 'leave',
						mousePosition: eP.mousePosition,
						gameView: this.hovered!,
						handle: this.hoveredHandle,
					} as MouseHoverEvolution
				this.hoveredHandle = last?.handle
				if (this.hoveredHandle)
					yield {
						type: 'enter',
						mousePosition: eP.mousePosition,
						gameView: this.hovered!,
						handle: this.hoveredHandle,
					} as MouseHoverEvolution
				yield {
					type: 'hover',
					mousePosition: eP.mousePosition,
					gameView: this.hovered!,
					handle: this.hoveredHandle,
				} as MouseHoverEvolution
			}
		}
	}

	raiseEvents() {
		for (const e of this.evolutions()) {
			this.emit(`mouse:${e.type}` as keyof MouseEvents, e as any)
			complete<PositionedMouseEvolution>(e)
			if (e.handle) {
				if (e.type.startsWith('drag') && this.drag) {
					const mde = e as MouseDragEvolution
					;(
						this.drag[
							{
								dragCancel: 'cancel',
								dragDrop: 'drop',
								dragOver: 'over',
								startDrag: 'error',
							}[mde.type] as keyof MouseDrag
						] as (evolution: MouseDragEvolution) => void
					)(mde)
				} else e.handle.target.emit(`mouse:${e.type}` as keyof HandledMouseEvents, e as any)
			}
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
			mouseleave: (e: MouseEvent) => this.mouseLeave(e),
			dblclick: (e: MouseEvent) => this.doubleClick(e),
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

		return this.rayCaster
			.intersectObjects(this.scene.children)
			.filter(
				(i) =>
					i.object?.userData?.mouseHandler &&
					this.drag?.dropValidation?.(this.drag, i.object?.userData?.mouseHandler) !== false
			)
	}
	mouseInteract({ gameView, mousePosition: position }: PositionedMouseEvolution) {
		const intersections = this.mouseIntersections(gameView, position)
		// Filter by distance THEN by o3d.renderOrder
		intersections.sort((a, b) =>
			a.distance !== b.distance
				? a.distance - b.distance
				: b.object.renderOrder - a.object.renderOrder
		)
		for (const intersection of intersections) {
			const userData = intersection.object.userData
			const handler = userData.mouseHandler as MouseHandler
			const handle = handler(this, userData.mouseTarget, intersection)
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
						mousePosition: { x: 0, y: 0 },
						handle: this.hoveredHandle,
					})
			}
		}
	})

	private lookAtCenter?: Vector3
	willLock(action: keyof MouseLockButtons, event: MouseEvent) {
		if (action === 'lookAt') {
			const center = this.mouseIntersections(this.hovered!, {
				x: event.offsetX,
				y: event.offsetY,
			})[0]
			if (!center) return false
			this.lookAtCenter = center.point
		}
		return true
	}
	private reLock(event: MouseEvent) {
		const shouldLock = Object.entries(mouseConfig.lockButtons).find(([k, c]) =>
			isCombination(event, c)
		)
		const lockConditions =
			shouldLock && this.willLock(shouldLock[0] as keyof MouseLockButtons, event)
		if (!!this.lockSemaphore.locked !== lockConditions)
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
				const lookAt = this.lookAtCenter!
				//TODO: Take the look-at point (at least x/y) at mousedown event
				break
			}
		}
	}

	private lastCursorEvolution?: MouseMoveEvolution
	private moveCursor(event: MouseEvent) {
		this.hovered =
			(event.target instanceof HTMLCanvasElement && this.views.get(event.target)) || undefined
		if (this.hovered && !!event.buttons && !this.drag && this.lastButtonDown) {
			this.drag = mouseDrag(this.lastButtonDown.button)
			this.evolve<MouseDragEvolution>({
				...this.lastButtonDown,
				type: 'startDrag',
				drag: this.drag,
			})
		}
		this.lastButtonDown = undefined
		if (this.lastEvolution?.type === 'move') this.lastEvolutions.pop()
		const evolution = {
			type: 'move',
			gameView: this.hovered,
			...(this.hovered
				? {
						buttons: event.buttons,
						modKeyCombination: modKeysCombinations(event),
						mousePosition: {
							x: event.offsetX,
							y: event.offsetY,
						},
					}
				: {
						buttons: 0,
						modKeyCombination: modKeysComb.none,
						mousePosition: null,
					}),
		} as MouseMoveEvolution
		this.lastCursorEvolution = evolution
		this.evolve(evolution)
		if (this.drag)
			this.evolve<MouseDragEvolution>({
				...evolution,
				type: 'dragOver',
				drag: this.drag,
			})
	}

	// #endregion
	// #region Events

	private mouseMove(event: MouseEvent) {
		if (this.lockedGV) this.moveCamera(event, this.lockedGV)
		else this.moveCursor(event)
	}
	private mouseDown(event: MouseEvent) {
		event.preventDefault()
		if (this.drag)
			this.evolve<MouseDragEvolution>({
				type: 'dragCancel',
				drag: this.drag,
				modKeyCombination: modKeysCombinations(event),
				mousePosition: { x: event.offsetX, y: event.offsetY },
				handle: undefined,
			})
		this.drag = undefined
		if (this.reLock(event)) this.lastButtonDown = undefined
		else {
			this.lastButtonDown = {
				type: 'down',
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				mousePosition: { x: event.offsetX, y: event.offsetY },
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
				mousePosition: { x: event.offsetX, y: event.offsetY },
				handle: undefined,
			})
		this.lastButtonDown = undefined
		if (this.drag)
			this.evolve<MouseDragEvolution>({
				type: 'dragDrop',
				drag: this.drag,
				modKeyCombination: modKeysCombinations(event),
				mousePosition: { x: event.offsetX, y: event.offsetY },
				handle: undefined,
			})
		this.drag = undefined
		this.evolve<MouseButtonEvolution>({
			type: 'up',
			button: event.button,
			buttons: event.buttons as MouseButtons,
			modKeyCombination: modKeysCombinations(event),
			mousePosition: { x: event.offsetX, y: event.offsetY },
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
					const center = this.mouseIntersections(this.hovered!, {
						x: event.offsetX,
						y: event.offsetY,
					})[0]
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
						mousePosition: { x: event.offsetX, y: event.offsetY },
						axis,
						modKeyCombination: modKeysCombinations(event),
						delta: delta[axis],
						handle: undefined,
					})
			}
	}

	private mouseLeave(event: MouseEvent) {
		if (this.hoveredHandle) {
			this.evolve<MouseHoverEvolution>({
				type: 'leave',
				mousePosition: {
					x: event.offsetX,
					y: event.offsetY,
				},
				handle: this.hoveredHandle,
			})
		}
	}

	private doubleClick(event: MouseEvent) {
		this.evolve<MouseButtonEvolution>({
			type: 'dblClick',
			button: event.button,
			buttons: event.buttons as MouseButtons,
			modKeyCombination: modKeysCombinations(event),
			mousePosition: { x: event.offsetX, y: event.offsetY },
			handle: this.hoveredHandle,
		})
	}

	// #endregion
}
