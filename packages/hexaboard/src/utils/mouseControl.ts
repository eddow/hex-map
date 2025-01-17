import {
	type Camera,
	type Intersection,
	type Object3D,
	type Object3DEventMap,
	Raycaster,
	Scene,
	Vector2,
	Vector3,
} from 'three'
import type { GameView } from '~/game/game'
import { wholeScale } from '~/game/terrain'
import type HexSector from '~/hexagon/sector'

export interface MouseReactive {
	mouseHandle(intersection: Intersection<Object3D<Object3DEventMap>>): MouseHandle
}
export abstract class MouseHandle {
	constructor(public readonly target: MouseReactive) {}
	abstract readonly tile: TileHandle
	abstract equals(other: MouseHandle): boolean
}

export class TileHandle extends MouseHandle {
	readonly tile = this

	constructor(
		public readonly target: HexSector,
		public readonly hexIndex: number
	) {
		super(target)
	}
	equals(other: MouseHandle) {
		return (
			other instanceof TileHandle &&
			other.target === this.target &&
			other.hexIndex === this.hexIndex
		)
	}
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
}
const modKeys = ['shift', 'alt', 'ctrl'] as const
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

const clampZ = { min: wholeScale, max: 500 }
export interface MouseConfig {
	lockButtons: MouseLockButtons
	zoomWheel: WheelCombination
	zoomSpeed: number
}
export const mouseConfig: MouseConfig = {
	lockButtons: {
		pan: { buttons: MouseButtons.Right | MouseButtons.Left, modifiers: modKeysComb.none },
		turn: { buttons: MouseButtons.Middle, modifiers: modKeysComb.none },
	},
	zoomWheel: { axis: 'y', modifiers: modKeysComb.none },
	zoomSpeed: 1.2,
}

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

// #region Evolutions

export interface MouseEvolution {
	type: string
}

interface MousePosition {
	x: number
	y: number
}

interface PositionedMouseEvolution extends MouseEvolution {
	target: GameView
	position: MousePosition | null
	handle?: MouseHandle
}

export interface MouseButtonEvolution extends PositionedMouseEvolution {
	type: 'click' | 'up' | 'down' | 'dragStart'
	button: MouseButton
	modKeyCombination: ModKeyCombination
}

export interface MouseDragEvolution extends PositionedMouseEvolution {
	type: 'dragEnd' | 'dragOver'
	dragStartHandle: MouseHandle
	button: MouseButton
	modKeyCombination: ModKeyCombination
}

export interface MouseEnterEvolution extends MouseEvolution {
	type: 'enter'
	target: GameView
}

export interface MouseMoveEvolution extends PositionedMouseEvolution {
	type: 'move'
	buttons: MouseButtons
}

export interface MouseHoverEvolution extends MouseEvolution {
	type: 'hover'
	target: GameView
	handle: MouseHandle
}

// #endregion

const mouseListeners: unique symbol = Symbol('Mouse events')
interface MouseEventsView extends GameView {
	[mouseListeners]: Record<string, (event: any) => void>
}

export class MouseControl {
	protected views = new Map<HTMLCanvasElement, GameView>()
	public readonly scene = new Scene()
	private hovered?: GameView
	private hoveredHandle?: MouseHandle
	private lastButtonDown?: MouseButtonEvolution
	private dragStartHandle?: MouseHandle
	private locked?: GameView
	private lastEvolutions: MouseEvolution[] = []

	get lastEvolution(): MouseEvolution | undefined {
		return this.lastEvolutions[this.lastEvolutions.length - 1]
	}
	evolve<Evolution extends MouseEvolution>(evolution: Evolution) {
		this.lastEvolutions.push(evolution)
	}

	*evolutions() {
		let lastPosition: MousePosition | undefined
		let lastHandle: MouseHandle | undefined
		const rv = this.lastEvolutions
		this.lastEvolutions = []
		for (const e of rv) {
			const eP = e as PositionedMouseEvolution
			if (eP.position) {
				if (lastPosition?.x === eP.position.x && lastPosition?.y === eP.position.y)
					eP.handle = lastHandle
				else {
					lastPosition = eP.position
					lastHandle = eP.handle = this.mouseInteract(eP)?.handle
				}
			}
			yield e
			if (
				!!this.hoveredHandle !== !!lastHandle ||
				(this.hoveredHandle && lastHandle && !this.hoveredHandle.equals(lastHandle))
			) {
				this.hoveredHandle = lastHandle
				yield {
					type: 'hover',
					target: this.hovered,
					handle: this.hoveredHandle,
				} as MouseHoverEvolution
			}
		}
	}

	// #region Event listeners book-keeping

	constructor() {
		document.addEventListener('pointerlockchange', () => this.pointerLockChange())
	}
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

	// #endregion
	// #region Mouse Interactions

	private readonly rayCaster = new Raycaster()
	mouseIntersection(eP: PositionedMouseEvolution) {
		if (!eP.target || !eP.position) return
		const { canvas, camera } = eP.target
		const mouse = new Vector2(
			(eP.position.x / canvas.clientWidth) * 2 - 1,
			-(eP.position.y / canvas.clientHeight) * 2 + 1
		)
		this.rayCaster.setFromCamera(mouse, camera)

		const intersects = this.rayCaster.intersectObjects(this.scene.children)

		const interact = intersects.findIndex((i) => i.object?.userData?.mouseTarget?.mouseHandle)
		if (interact > -1) return intersects[interact]
	}
	mouseInteract(eP: PositionedMouseEvolution) {
		const intersection = this.mouseIntersection(eP)
		if (intersection) {
			const target = intersection.object?.userData?.mouseTarget as MouseReactive
			return {
				intersection,
				handle: target.mouseHandle(intersection),
			}
		}
	}
	private reLock(event: MouseEvent) {
		const shouldLock = Object.values(mouseConfig.lockButtons).some((c) => isCombination(event, c))
		if (!!this.locked !== shouldLock) {
			if (shouldLock) this.hovered!.canvas.requestPointerLock()
			else document.exitPointerLock()
		}
		return shouldLock
	}

	private moveCamera(event: MouseEvent, camera: Camera) {
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
				if (frontVector.z < 0) camera.rotateX(Math.asin(frontVector.z))
				break
			}
			case 'pan': {
				const displacement = camera.position.z / 1000
				const xv = new Vector3(1, 0, 0)
				xv.applyQuaternion(camera.quaternion)
				const upVector = new Vector3(0, 1, 0) // Local up direction
				const worldUpVector = upVector.applyQuaternion(camera.quaternion)

				// Step 2: Project onto the plane (set z to 0)
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
			}
			// TODO case 'lookAt': = look at the same point and turn around
		}
	}

	// #endregion
	// #region Events

	private pointerLockChange() {
		const locked = document.pointerLockElement
		const shouldLock = (locked instanceof HTMLCanvasElement && this.views.get(locked)) || null
		if (this.locked && !shouldLock) {
			this.hovered = this.locked
			this.evolve({ type: 'unlock', target: this.locked! })
			this.locked = undefined
		} else if (!this.locked && shouldLock) {
			this.hovered = undefined
			this.evolve({ type: 'lock', target: shouldLock })
			this.locked = shouldLock
		}
	}

	private mouseMove(event: MouseEvent) {
		if (this.locked) this.moveCamera(event, this.locked.camera)
		else {
			this.hovered =
				(event.target instanceof HTMLCanvasElement && this.views.get(event.target)) || undefined
			if (this.hovered && !!event.buttons && !this.dragStartHandle && this.lastButtonDown) {
				this.dragStartHandle = this.mouseInteract(this.lastButtonDown!)?.handle
				if (this.dragStartHandle) {
					this.evolve({
						...this.lastButtonDown,
						type: 'dragStart',
					})
				}
				this.lastButtonDown = undefined
			}
			this.lastButtonDown = undefined
			if (this.lastEvolution?.type === 'move') this.lastEvolutions.pop()
			const evolution = {
				type: 'move',
				target: this.hovered,
				...(this.hovered
					? {
							buttons: event.buttons,
							modKeyCombination: modKeysCombinations(event),
							position: {
								x: event.clientX,
								y: event.clientY,
							},
						}
					: {
							buttons: 0,
							modKeyCombination: modKeysComb.none,
							position: null,
						}),
			}
			this.evolve(evolution)
			if (this.dragStartHandle) {
				this.evolve({
					...evolution,
					type: 'dragOver',
					dragStartHandle: this.dragStartHandle,
				})
			}
		}
	}
	private mouseDown(event: MouseEvent) {
		this.dragStartHandle = undefined
		if (this.reLock(event)) this.lastButtonDown = undefined
		else {
			this.lastButtonDown = {
				type: 'down',
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				target: this.hovered!,
				position: { x: event.clientX, y: event.clientY },
			}
			this.evolve(this.lastButtonDown)
		}
	}

	private mouseUp(event: MouseEvent) {
		if (event.buttons === 0 && this.lastButtonDown?.button === event.button)
			this.evolve({
				type: 'click',
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				target: this.hovered!,
				position: { x: event.clientX, y: event.clientY },
			})
		this.lastButtonDown = undefined
		if (this.dragStartHandle) {
			this.evolve({
				type: 'dragEnd',
				dragStartHandle: this.dragStartHandle,
				button: event.button,
				modKeyCombination: modKeysCombinations(event),
				target: this.hovered!,
				position: { x: event.clientX, y: event.clientY },
			})
		}
		this.dragStartHandle = undefined
		this.evolve({
			type: 'up',
			button: event.button,
			modKeyCombination: modKeysCombinations(event),
			target: this.hovered!,
			position: { x: event.clientX, y: event.clientY },
		})
		this.reLock(event)
	}
	private contextMenu(event: Event) {
		event.preventDefault()
	}
	private mouseWheel(event: WheelEvent) {
		const delta = { x: event.deltaX / 96, y: event.deltaY / 120 }

		for (const axis of ['x', 'y'] as const)
			if (delta[axis]) {
				if (
					mouseConfig.zoomWheel.axis === axis &&
					isModKeyCombination(event, mouseConfig.zoomWheel.modifiers)
				) {
					const center = this.mouseIntersection({
						type: 'zoom',
						target: this.hovered!,
						position: { x: event.clientX, y: event.clientY },
					})
					const camera = this.hovered!.camera
					if (center) {
						const dist = camera.position.clone().sub(center.point)
						dist.multiplyScalar(mouseConfig.zoomSpeed ** delta[axis])
						camera.position.copy(center.point).add(dist)
						if (camera.position.z > clampZ.max) camera.position.z = clampZ.max
						else if (camera.position.z < clampZ.min) camera.position.z = clampZ.min
					}
				} else
					this.evolve({
						type: 'wheel',
						axis,
						modKeyCombination: modKeysCombinations(event),
						delta: delta[axis],
					})
			}
	}

	private mouseEnter(event: MouseEvent) {}
	private mouseLeave(event: MouseEvent) {
		// In case it has entered in another canvas then receive the `leave` just milliseconds later
		this.mouseMove(Object.create(event, { target: { value: null } }))
	}

	// #endregion
}