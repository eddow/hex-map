import {
	AmbientLight,
	DirectionalLight,
	PerspectiveCamera,
	Scene,
	Vector3,
	WebGLRenderer,
} from 'three'
import { mouseControls } from '~/utils/mouse'
import LCG from '~/utils/random'
import { Character } from './character'
import { HeightPowGen } from './hexagon/pow2Gen'
import { hoveredSpecs, interactionContext } from './utils/interact'
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
// Create and Add Hexagonal Grid
const sector = new HeightPowGen(new Vector3(0, 0, 0), 10, 6)
sector.generate(LCG(worldSeed))
sector.virgin()
sector.meshTerrain()
sector.meshResources()
scene.add(sector.group)

const pawn = new Character(sector, 0, sphere(2, { color: 0xff0000 }))
//const pawn = new Character(sector, 0, meshAsset('/assets/man.glb'))
scene.add(pawn.mesh)
interactionContext.pawn = pawn

const characters: Character[] = [pawn]

// Position the Camera
camera.position.set(0, 0, 100)
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
	for (const character of characters) character.progress(dt)
	renderer.render(scene, camera)
}

animate(0)
