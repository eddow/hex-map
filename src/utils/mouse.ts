import {
	type Camera,
	type Intersection,
	type Object3D,
	type Object3DEventMap,
	Raycaster,
	type Scene,
	Vector2,
	Vector3,
} from 'three'

export const mouse = new Vector2()
export interface MouseLockButtons {
	pan?: number
	turn?: number
	lookAt?: number
}
export interface MouseConfig {
	lockButtons: MouseLockButtons
}
export const mouseConfig: MouseConfig = {
	lockButtons: { pan: 3, turn: 4 },
}

export function mouseControls(canvas: HTMLCanvasElement, camera: Camera, scene: Scene) {
	const rayCaster = new Raycaster()

	function mouseIntersect(event: MouseEvent) {
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
		rayCaster.setFromCamera(mouse, camera)

		const intersects = rayCaster.intersectObjects(scene.children)

		const interact = intersects.findIndex((i) => i.object?.userData?.item?.mouse)
		if (interact > -1) {
			return {
				intersect: intersects[interact],
				item: intersects[interact].object?.userData?.item as MouseReactive,
			}
		}
	}

	// Pointer lock setup
	let buttons = 0
	let hasLock = false

	function onPointerLockChange() {
		hasLock = document.pointerLockElement === canvas
	}

	let objectHovered: MouseReactive | undefined
	let lastButtonDown: number | undefined

	function mouseMove(event: MouseEvent) {
		lastButtonDown = undefined
		if (hasLock) {
			// Relative mouse movement
			const { dx, dy } = { dx: event.movementX, dy: event.movementY } // Relative mouse event
			let movement: undefined | keyof MouseLockButtons
			for (const key in mouseConfig.lockButtons)
				if (mouseConfig.lockButtons[key as keyof MouseLockButtons] === buttons) {
					movement = key as keyof MouseLockButtons
					break
				}

			switch (movement) {
				case 'turn': {
					// Rotate camera
					// x: movement rotates the camera around the word's Z axis
					camera.rotateOnWorldAxis(new Vector3(0, 0, -1), dx * 0.01)
					// y: camera tilts between horizontal (plan: z=0) and vertical (look along Z axis) positions
					// todo: clamp
					camera.rotateX(-dy * 0.01) // Apply tilt rotation
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
			}
		} else {
			const intersection = mouseIntersect(event)
			if (objectHovered !== intersection?.item) {
				objectHovered?.mouse('move')
				objectHovered = intersection?.item
			}
			intersection?.item?.mouse('move', intersection.intersect)
		}
	}

	function onMouseWheel(event: WheelEvent) {
		// Normalize the wheel delta for consistent zoom behavior
		const delta = event.deltaY > 0 ? 1 : -1

		// Adjust the camera's zoom or position
		const zoomSpeed = 1.2
		camera.position.z *= zoomSpeed ** delta

		// Optionally, clamp the zoom level to prevent the camera from getting too close or far
		camera.position.z = Math.max(2, Math.min(500, camera.position.z)) // Example clamp between 2 and 50
	}

	function reLock(event: MouseEvent) {
		buttons = event.buttons
		const shouldLock = Object.values(mouseConfig.lockButtons).includes(buttons)
		if (!hasLock && shouldLock) canvas.requestPointerLock()
		else if (hasLock && !shouldLock) document.exitPointerLock()
	}

	function mouseDown(event: MouseEvent) {
		lastButtonDown = event.button
		reLock(event)

		const intersection = mouseIntersect(event)
		intersection?.item?.mouse('down', intersection.intersect, event.button)
	}

	function mouseUp(event: MouseEvent) {
		const intersection = mouseIntersect(event)
		intersection?.item?.mouse('up', intersection.intersect, event.button)
		if (event.buttons === 0 && lastButtonDown === event.button) {
			intersection?.item?.mouse('click', intersection.intersect, event.button)
		}
		lastButtonDown = undefined
		reLock(event)
	}

	// Attach event listeners
	document.addEventListener('mousemove', mouseMove)
	document.addEventListener('pointerlockchange', onPointerLockChange)
	canvas.addEventListener('mousedown', mouseDown)
	canvas.addEventListener('mouseup', mouseUp)
	canvas.addEventListener('contextmenu', (e) => e.preventDefault())
	canvas.addEventListener('wheel', onMouseWheel)
}

export type MouseAction = 'move' | 'enter' | 'leave' | 'down' | 'up' | 'click'

export interface MouseReactive {
	mouse(
		action: MouseAction,
		intersection?: Intersection<Object3D<Object3DEventMap>>,
		button?: number
	): void
}
