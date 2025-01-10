import * as THREE from 'three'
import { c } from 'vite/dist/node/types.d-aGj9QkWt'

export function mouseControls(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
	// Pointer lock setup
	let buttons = 0
	let hasLock = false

	function onPointerLockChange() {
		if (document.pointerLockElement === canvas) {
			document.addEventListener('mousemove', lockedMouseMove)
		} else {
			document.removeEventListener('mousemove', lockedMouseMove)
		}
	}

	function lockedMouseMove(event: MouseEvent) {
		// Relative mouse movement
		const { dx, dy } = { dx: event.movementX, dy: event.movementY } // Relative mouse mevent
		switch (buttons) {
			case 4: {
				// Rotate camera
				// x: movement rotates the camera around the word's Z axis
				camera.rotateOnWorldAxis(new THREE.Vector3(0, 0, -1), dx * 0.01)
				// y: camera tilts between horizontal (plan: z=0) and vertical (look along Z axis) positions
				// todo: clamp
				camera.rotateX(-dy * 0.01) // Apply tilt rotation
				break
			}
			case 2: {
				const displacement = camera.position.z / 1000
				const xv = new THREE.Vector3(1, 0, 0)
				xv.applyQuaternion(camera.quaternion)
				const upVector = new THREE.Vector3(0, 1, 0) // Local up direction
				const worldUpVector = upVector.applyQuaternion(camera.quaternion)

				// Step 2: Project onto the plane (set z to 0)
				const projectedUp = new THREE.Vector3(worldUpVector.x, worldUpVector.y, 0)

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
	}

	// Attach event listeners
	document.addEventListener('pointerlockchange', onPointerLockChange)
	canvas.addEventListener('mousedown', mouseDown)
	canvas.addEventListener('mouseup', mouseUp)
	canvas.addEventListener('contextmenu', (e) => e.preventDefault())
	canvas.addEventListener('wheel', onMouseWheel)

	function onMouseWheel(event: WheelEvent) {
		// Normalize the wheel delta for consistent zoom behavior
		const delta = event.deltaY > 0 ? 1 : -1

		// Adjust the camera's zoom or position
		const zoomSpeed = 1.2
		camera.position.z *= zoomSpeed ** delta

		// Optionally, clamp the zoom level to prevent the camera from getting too close or far
		camera.position.z = Math.max(2, Math.min(500, camera.position.z)) // Example clamp between 2 and 50
	}

	function mouseDown(event: MouseEvent) {
		buttons = event.buttons
		if (buttons & 6 && !hasLock) {
			hasLock = true
			canvas.requestPointerLock()
		}
	}

	function mouseUp(event: MouseEvent) {
		buttons = event.buttons
		if (!(buttons & 6) && hasLock) {
			hasLock = false
			document.exitPointerLock()
		}
	}
}
