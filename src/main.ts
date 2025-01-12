import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { mouseControls } from '~/utils/mouse'
import LCG from '~/utils/random'
import { Character } from './character'
import { HexClown } from './hexagon/examples/clown'
import { HeightPowGen } from './hexagon/pow2Gen'
import type { Measures } from './hexagon/section'
import { hoveredSpecs } from './utils/interact'
import { sphere } from './utils/meshes'

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
const measures: Measures = { tileSize: 10, position: { x: 0, y: 0, z: 0 }, gen: LCG(worldSeed) }
// Create and Add Hexagonal Grid
const sector = new HeightPowGen(measures, 6)
//const sector = new HexClown(measures, 5)
sector.generate()
scene.add(sector.group)

const pawn = new Character(sector, { q: 0, r: 0 }, sphere(2, { color: 0xff0000 }))
scene.add(pawn.mesh)

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
let lastTime = 0
// Animate
function animate(time: DOMHighResTimeStamp) {
	const dt = (time - lastTime) / 1000
	lastTime = time
	requestAnimationFrame(animate)
	hoveredSpecs.interaction?.animate?.(dt)
	renderer.render(scene, camera)
}

animate(0)
