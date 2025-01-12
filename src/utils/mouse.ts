import { type Camera, Raycaster, type Scene, Vector2, Vector3 } from 'three'
import { type InteractionSpecs, type MouseReactive, hoveredSpecs } from './interact'

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

	function mouseInteract(event: MouseEvent): InteractionSpecs | undefined {
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
		rayCaster.setFromCamera(mouse, camera)

		const intersects = rayCaster.intersectObjects(scene.children)

		const interact = intersects.findIndex((i) => i.object?.userData?.mouseTarget?.mouseInteraction)
		if (interact > -1) {
			const mouseTarget = intersects[interact].object?.userData?.mouseTarget as MouseReactive
			return {
				interaction: mouseTarget.mouseInteraction,
				handle: mouseTarget.mouseHandle?.(intersects[interact]) || { target: mouseTarget },
			}
		}
	}

	// Pointer lock setup
	let hasLock = false

	function onPointerLockChange() {
		hasLock = document.pointerLockElement === canvas
	}

	let lastButtonDown: number | undefined

	function mouseMove(event: MouseEvent) {
		lastButtonDown = undefined
		if (hasLock) {
			// Relative mouse movement
			const { dx, dy } = { dx: event.movementX, dy: event.movementY } // Relative mouse event
			let movement: undefined | keyof MouseLockButtons
			for (const key in mouseConfig.lockButtons)
				if (mouseConfig.lockButtons[key as keyof MouseLockButtons] === event.buttons) {
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
				// TODO case 'lookAt': = look at the same point and turn around
			}
		} else {
			const interactionSpecs = mouseInteract(event)
			if (
				hoveredSpecs.interaction &&
				hoveredSpecs.handle!.target !== interactionSpecs?.handle.target
			)
				hoveredSpecs.interaction.leave?.(hoveredSpecs.handle!)
			if (!hoveredSpecs.interaction && interactionSpecs)
				interactionSpecs.interaction.enter?.(interactionSpecs.handle)
			if (interactionSpecs)
				interactionSpecs.interaction.move?.(interactionSpecs.handle, hoveredSpecs?.handle)

			if (interactionSpecs) Object.assign(hoveredSpecs, interactionSpecs)
			else
				for (const key of Object.keys(hoveredSpecs) as Array<keyof InteractionSpecs>)
					delete hoveredSpecs[key]
		}
	}

	function onMouseWheel(event: WheelEvent) {
		// Normalize the wheel delta for consistent zoom behavior
		const delta = event.deltaY > 0 ? 1 : -1
		// TODO: better zoom algorithm: use mouse intersection to approach/move away from a point
		// Adjust the camera's zoom or position
		const zoomSpeed = 1.2
		camera.position.z *= zoomSpeed ** delta

		// Optionally, clamp the zoom level to prevent the camera from getting too close or far
		camera.position.z = Math.max(2, Math.min(500, camera.position.z)) // Example clamp between 2 and 50
		// TODO: cursor out of mouse pointer after zoom: calling mouseMove is not enough
		//mouseMove(event)
	}

	function reLock(event: MouseEvent) {
		const shouldLock = Object.values(mouseConfig.lockButtons).includes(event.buttons)
		if (!hasLock && shouldLock) canvas.requestPointerLock()
		else if (hasLock && !shouldLock) document.exitPointerLock()
	}

	function mouseDown(event: MouseEvent) {
		lastButtonDown = event.button
		reLock(event)

		const interactionSpecs = mouseInteract(event)
		interactionSpecs?.interaction?.down?.(interactionSpecs.handle, event.button)
	}

	function mouseUp(event: MouseEvent) {
		const interactionSpecs = mouseInteract(event)
		if (interactionSpecs) {
			interactionSpecs.interaction.up?.(interactionSpecs.handle, event.button)
			if (event.buttons === 0 && lastButtonDown === event.button)
				interactionSpecs.interaction.click?.(interactionSpecs.handle, event.button)
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
