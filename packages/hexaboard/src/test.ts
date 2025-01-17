import { Vector3 } from 'three'
import LCG from '~/utils/random'
import { Character } from './game/character'
import { TileCursor } from './game/entities'
import { Game } from './game/game'
import { MonoSectorLand } from './game/land'
import { Island } from './hexagon/island'
import { icosahedron, sphere } from './utils/meshes'
import {
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	type TileHandle,
} from './utils/mouseControl'
// const worldSeed = 0.43 // TODO: contains artifacts in the sea
const worldSeed = Math.random()
const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6))
land.generate(LCG(worldSeed))
land.virgin()
land.mesh()
const game = new Game(land)

const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
game.addEntity(pawn)

const gameView = game.createView()
// Position the Camera
gameView.camera.position.set(0, 0, 100)
gameView.camera.lookAt(0, 0, 0)
gameView.resize(window.innerWidth, window.innerHeight)

// Handle Window Resize
window.addEventListener('resize', () => {
	gameView.resize(window.innerWidth, window.innerHeight)
})

const cursor = new TileCursor(
	icosahedron(land.tileSize / Math.sqrt(3), {
		color: 0xffffff,
		wireframe: true,
	})
)
game.onMouse('hover', (ev: MouseHoverEvolution) => {
	cursor.tile = ev.handle as TileHandle
})
game.onMouse('click', (ev: MouseButtonEvolution) => {
	const tile = ev.handle as TileHandle
	if (ev.button === MouseButton.Left) pawn.goTo(tile.target, tile.hexIndex)
})
game.addEntity(cursor)
document.body.appendChild(gameView.canvas)
game.running = true
