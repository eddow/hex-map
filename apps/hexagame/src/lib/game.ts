import * as m from '$lib/paraglide/messages'
import {
	type Axial,
	Game,
	MonoSectorLand,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	TexturedLandscape,
	TileCursor,
	axialIndex,
	costingPath,
	icosahedron,
	pointsAround,
} from 'hexaboard'
import { NoiseProcedural } from 'hexaboard'
import { CatmullRomCurve3, Mesh, MeshBasicMaterial, type Object3D, TubeGeometry } from 'three'
import { dockview } from './globals.svelte'
import terrains from './world/terrain'

export function createGame(seed: number) {
	const worldSeed = 0.77
	//const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6, terrains))
	const landscape = new TexturedLandscape(20)
	const procedural = new NoiseProcedural(32)

	const land = new MonoSectorLand(terrains, procedural, landscape, worldSeed)

	const game = new Game<MonoSectorLand>(land)

	//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	//const pawn = new Character(land.sector, 0, new Object3D())
	//game.addEntity(pawn)
	const cursor = new TileCursor(
		icosahedron(land.tileSize / Math.sqrt(3), {
			color: 0xffffff,
			wireframe: true,
		})
	)

	function axialV3(axial: Axial | number) {
		return game.land.landscape.tileCenter(
			game.land.sector,
			typeof axial === 'number' ? axial : axialIndex(axial)
		)
	}
	let pathTube: Object3D | undefined
	game.onMouse('hover', (ev: MouseHoverEvolution) => {
		cursor.tile = ev.handle?.tile

		if (pathTube) {
			game.scene.remove(pathTube)
			pathTube = undefined
		}
		if (cursor.tile) {
			//if (pawn.tile !== cursor.tile.hexIndex) {
			const sector = game.land.sector
			/* straight path
				const path = [
					axialAt(pawn.tile),
					...straightPath(pawn.sector, pawn.tile, cursor.tile.target, cursor.tile.hexIndex),
				]*/
			/* no height path (0 height diff still has horz mvt not counted)
				const path = costingPath(
					cursor.tile.hexIndex,
					(from, to) =>
						to < sector.tiles.length ? (sector.points[from].z - sector.points[to].z) ** 2 : Number.NaN,
					(hexIndex) => hexIndex < sector.tiles.length && pawn.tile === hexIndex
				)*/
			const path = costingPath(
				cursor.tile.hexIndex,
				(from, to) =>
					to < sector.tiles.length
						? // The fact to climb up
							Math.max(0, sector.tiles[to].z - sector.tiles[from].z) ** 2 +
							// The fact to not take the strongest down slope
							sector.tiles[to].z -
							Math.min(...pointsAround(from, sector.tiles.length).map((p) => sector.tiles[p].z))
						: Number.NaN,
				(hexIndex) => hexIndex < sector.tiles.length && sector.tiles[hexIndex].z < 0
			)
			if (path && path.length > 1) {
				const pathCurve = new CatmullRomCurve3(path.map((p) => axialV3(p)))
				const pathGeometry = new TubeGeometry(pathCurve, path.length * 5, 2, 8, false)
				const pathMaterial = new MeshBasicMaterial({ color: 0xffff00, wireframe: true })
				pathTube = new Mesh(pathGeometry, pathMaterial)
				game.scene.add(pathTube)
			}
			//}
		}
	})
	game.onMouse('click', (ev: MouseButtonEvolution) => {
		const tile = ev.handle?.tile
		if (tile)
			switch (ev.button) {
				case MouseButton.Left:
					//pawn.goTo(tile.target, tile.hexIndex)
					break
				case MouseButton.Right:
					dockview.api.addPanel({
						id: `selectionInfo.${crypto.randomUUID()}`,
						component: 'selectionInfo',
						title: m.selectInfo(),
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
