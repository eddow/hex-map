import {
	Character,
	Game,
	Island,
	LCG,
	MonoSectorLand,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	TileCursor,
	type TileHandle,
	icosahedron,
	sphere,
} from 'hexaboard'
import { Vector3 } from 'three'
import terrains from './world/terrain'

export function createGame(seed: number) {
	const worldSeed = Math.random()
	const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6, terrains))
	land.generate(LCG(worldSeed))
	land.virgin()
	land.mesh()

	const game = new Game(land)

	const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	game.addEntity(pawn)
	const cursor = new TileCursor(
		icosahedron(land.tileSize / Math.sqrt(3), {
			color: 0xffffff,
			wireframe: true,
		})
	)
	game.onMouse('hover', (ev: MouseHoverEvolution) => {
		cursor.tile = ev.handle?.tile
	})
	game.onMouse('click', (ev: MouseButtonEvolution) => {
		const tile = ev.handle as TileHandle
		if (ev.button === MouseButton.Left) pawn.goTo(tile.target, tile.hexIndex)
	})
	game.addEntity(cursor)

	return game
}
