import { Vector3 } from 'three'
import { mouseControls } from '~/utils/mouse'
import LCG from '~/utils/random'
import { Character } from './character'
import { Game } from './game/game'
import { MonoSectorLand } from './game/land'
import { Island } from './hexagon/island'
import { hoveredSpecs, interactionContext } from './utils/interact'
import { sphere } from './utils/meshes'
// const worldSeed = 0.43 // TODO: contains artifacts in the sea
const worldSeed = Math.random()
const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6))
land.generate(LCG(worldSeed))
land.virgin()
land.mesh()
const game = new Game(land)

const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
game.addCharacter(pawn)

const gameView = game.createView()
// Position the Camera
gameView.camera.position.set(0, 0, 100)
gameView.camera.lookAt(0, 0, 0)
gameView.resize(window.innerWidth, window.innerHeight)

interactionContext.pawn = pawn
mouseControls(gameView.domElement, gameView.camera, game.scene)

// Handle Window Resize
window.addEventListener('resize', () => {
	gameView.resize(window.innerWidth, window.innerHeight)
})

document.body.appendChild(gameView.domElement)
game.start((dt) => {
	hoveredSpecs.interaction?.animate?.(dt)
})
