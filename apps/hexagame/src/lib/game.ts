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
	icosahedron,
	sphere,
} from 'hexaboard'
import { Vector3 } from 'three'
import { dockview } from './globals.svelte'
import terrains from './world/terrain'

let tileInfoPanels = 0
export function createGame(seed: number) {
	const worldSeed = 0.43
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
		const tile = ev.handle?.tile
		if (tile)
			switch (ev.button) {
				case MouseButton.Left:
					pawn.goTo(tile.target, tile.hexIndex)
					break
				case MouseButton.Right:
					dockview.api.addPanel({
						id: `tileInfo.${tileInfoPanels++}`,
						component: 'tileInfo',
						params: {
							//sector: tile.target,
							hexIndex: tile.hexIndex,
						},
						floating: true,
					})
					break
			}
	})
	game.addEntity(cursor)

	return game
}
