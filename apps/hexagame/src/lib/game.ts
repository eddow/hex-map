import * as m from '$lib/paraglide/messages'
import {
	type AxialRef,
	Game,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	type ResourcefulTerrain,
	TexturedLandscape,
	type TexturedTerrain,
	type TileBase,
	TileCursor,
	WateredLand,
	axial,
	cartesian,
	costingPath,
	icosahedron,
	numbers,
	pointsAround,
} from 'hexaboard'
import { NoiseProcedural } from 'hexaboard'
import { CatmullRomCurve3, Mesh, MeshBasicMaterial, type Object3D, TubeGeometry } from 'three'
import { debugInfo, dockview } from './globals.svelte'
import terrains, { terrainHeight } from './world/terrain'

export function createGame(seed: number) {
	//const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6, terrains))
	const landscape = new TexturedLandscape(20, terrains.textures)
	//const landscape = new UniformLandscape(20)
	type Terrain = ResourcefulTerrain & TexturedTerrain
	type Tile = TileBase<Terrain>
	const procedural = new NoiseProcedural<Tile>(13, terrainHeight, 73058, 20)

	const land = new WateredLand({
		terrains,
		procedural,
		landscape,
		seed,
		tileRadius: 1,
		seaLevel: 27,
	})

	const game = new Game(land)
	const centralSector = game.land.sector(0)
	for (const sn of numbers(2)) game.land.sector(sn)
	//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	//const pawn = new Character(land.sector, 0, new Object3D())
	//game.addEntity(pawn)
	const cursor = new TileCursor(
		icosahedron(landscape.tileSize, {
			color: 0xffffff,
			wireframe: true,
		})
	)

	function axialV3(aRef: AxialRef) {
		return game.land.landscape.worldTileCenter(centralSector, axial.coords(aRef))
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
			/* straight path
				const path = [
					axialAt(pawn.tile),
					...straightPath(pawn.sector, pawn.tile, cursor.tile.target, cursor.tile.hexIndex),
				]*/
			/* no height path (0 height diff still has horizontal mvt not counted)
				const path = costingPath(
					cursor.tile.hexIndex,
					(from, to) =>
						to < sector.nbrTiles ? (sector.points[from].z - sector.points[to].z) ** 2 : Number.NaN,
					(hexIndex) => hexIndex < sector.nbrTiles && pawn.tile === hexIndex
				)*/
			const path = costingPath(
				cursor.tile.hexIndex,
				(from, to) =>
					to < centralSector.nbrTiles
						? // The fact to climb up
							Math.max(0, centralSector.tiles[to].z - centralSector.tiles[from].z) ** 2 +
							// The fact to not take the strongest down slope
							centralSector.tiles[to].z -
							Math.min(
								...pointsAround(from, centralSector.nbrTiles).map((p) => centralSector.tiles[p].z)
							)
						: Number.NaN,
				(hexIndex) => hexIndex < centralSector.nbrTiles && centralSector.tiles[hexIndex].z < 0
			)
			if (path && path.length > 1) {
				const pathCurve = new CatmullRomCurve3(path.map((p) => axialV3(p)))
				const pathGeometry = new TubeGeometry(pathCurve, path.length * 5, 2, 8, false)
				const pathMaterial = new MeshBasicMaterial({ color: 0xffff00, wireframe: true })
				pathTube = new Mesh(pathGeometry, pathMaterial)
				game.scene.add(pathTube)
			}
			//}
			debugInfo.tile = cursor.tile.target.worldTile(cursor.tile.hexIndex)
			debugInfo.tilePos = cartesian(debugInfo.tile, 20)
		} else {
			debugInfo.tilePos = debugInfo.tile = 'none'
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
