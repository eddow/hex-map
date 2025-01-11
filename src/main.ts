import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import LCG from '~/utils/lcg'
import { mouseControls } from '~/utils/mouse'
import { HexClown, type Measures } from './hexagon/patch'
import { HeightPowGen } from './hexagon/pow2Gen'

// Initialize Scene, Camera, and Renderer
const scene = new Scene()
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// Add Lighting
const light = new DirectionalLight(0xffffff, 1)
light.position.set(10, 10, 10)
scene.add(light)

const ambientLight = new AmbientLight(0x404040)
scene.add(ambientLight)

const worldSeed = 0.43
const measures: Measures = { tileSize: 10, position: { x: 0, y: 0 }, scene, gen: LCG(worldSeed) }
// Create and Add Hexagonal Grid
const hPatch = new HeightPowGen(measures, 5)
//const hPatch = new HexClown(measures, 5)
scene.add(hPatch.group)

// Position the Camera
camera.position.set(0, 0, 500)
camera.lookAt(0, 0, 0)

mouseControls(renderer.domElement, camera, scene)

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
