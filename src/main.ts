import * as THREE from 'three'
import { HeightPowGen } from './hexagon/pow2Gen'
import { mouseControls } from './utils/mouse'

// Initialize Scene, Camera, and Renderer
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// Add Lighting
const light = new THREE.DirectionalLight(0xffffff, 1)
light.position.set(10, 10, 10)
scene.add(light)

const ambientLight = new THREE.AmbientLight(0x404040)
scene.add(ambientLight)

// Create and Add Hexagonal Grid
const hPatch = new HeightPowGen({ tileSize: 10, position: { x: 0, y: 0 } }, 2)
scene.add(hPatch.group)

// Position the Camera
camera.position.set(0, 0, 100)
camera.lookAt(0, 0, 0)

mouseControls(renderer.domElement, camera)

// Handle Window Resize
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setSize(window.innerWidth, window.innerHeight)
})

// Animate
function animate() {
	requestAnimationFrame(animate)
	renderer.render(scene, camera)
}

animate()
