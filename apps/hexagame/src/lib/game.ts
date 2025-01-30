import {
	ColorRoadGrid,
	type ContentTile,
	Game,
	HeightTerrain,
	Land,
	Landscaper,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	OceanLandscape,
	PerlinHeight,
	Resourceful,
	type RiverTile,
	Rivers,
	type RoadTile,
	TextureLandscape,
	TileCursor,
	TileHandle,
	axial,
	icosahedron,
} from 'hexaboard'
import type { Object3D } from 'three'
import { debugInfo, dockview, games } from './globals.svelte'
import { roadTypes, seaLevel, terrainHeight, terrains } from './world/textures'

export type GameXTile = ContentTile & RoadTile & RiverTile
export type GameXLand = Land<GameXTile>

export function createGame(seed: number) {
	const land = new Land<GameXTile>(4, 20)
	const landscape = new TextureLandscape<GameXTile>(terrains, roadTypes, seed)
	land.addPart(
		new PerlinHeight<GameXTile>(terrainHeight, seed, 1000),
		new HeightTerrain<GameXTile>(terrainHeight / 10, seed, terrains, 1000),

		new Landscaper<GameXTile>(
			land.sectorRadius,
			new Rivers<GameXTile>(land, seed, seaLevel, terrainHeight, 96, 0.03),
			landscape,
			new ColorRoadGrid<GameXTile>(roadTypes),
			new OceanLandscape(seaLevel)
		),
		new Resourceful(terrains, seed, seaLevel)
	)

	const game = new Game(land, { clampCamZ: { min: 150, max: 700 } })

	//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	//const pawn = new Character(land.sector, 0, new Object3D())
	//game.addEntity(pawn)
	const cursor = new TileCursor(
		icosahedron(20, {
			color: 0xffffff,
			wireframe: true,
		})
	)

	/*function axialV3(aRef: AxialRef) {
		return tileSpec(aRef).center
	}*/
	let pathTube: Object3D | undefined
	landscape.on({
		'mouse:hover': (ev: MouseHoverEvolution<TileHandle>) => {
			cursor.tile = ev.handle

			if (pathTube) {
				game.scene.remove(pathTube)
				pathTube = undefined
			}
			//if (pawn.tile !== cursor.tile.hexIndex) {
			/*try {
				/* straight path
				const path = [
					axial.coord(pawn.tile),
					...straightPath(pawn.sector, pawn.tile, cursor.tile.target, cursor.tile.hexIndex),
				]*/
			/* no height path (0 height diff still has horizontal mvt not counted)
				const path = costingPath(
					cursor.tile.hexIndex,
					(from, to) =>
						to < sector.nbrTiles ? (sector.points[from].z - sector.points[to].z) ** 2 : Number.NaN,
					(hexIndex) => hexIndex < sector.nbrTiles && pawn.tile === hexIndex
				)*/
			/*
				if (path && path.length > 1) {
					const pathCurve = new CatmullRomCurve3(path.map((p) => axialV3(p)))
					const pathGeometry = new TubeGeometry(pathCurve, path.length * 5, 2, 8, false)
					const pathMaterial = new MeshBasicMaterial({ color: 0xffff00, wireframe: true })
					pathTube = new Mesh(pathGeometry, pathMaterial)
					game.scene.add(pathTube)
				}* /
			} catch (e) {
				// Ignore SectorNotGeneratedError
				if (!(e instanceof SectorNotGeneratedError)) throw e
			}*/
			//}
			debugInfo.axial = cursor.tile?.point
			const tile = ev.handle.tile
			debugInfo.tilePos = tile.position
			debugInfo.riverHeight = (tile as GameXTile).riverHeight
		},
		'mouse:leave': (ev: MouseHoverEvolution<TileHandle>) => {
			cursor.tile = undefined
			debugInfo.axial = undefined
			debugInfo.tilePos = undefined
			debugInfo.riverHeight = undefined
		},
	})
	game.on('mouse:click', (ev: MouseButtonEvolution) => {
		if (ev.handle instanceof TileHandle) {
			const hKey = ev.handle?.point.key
			const game = ev.handle?.game
			if (hKey)
				switch (ev.button) {
					case MouseButton.Left:
						//pawn.goTo(tile.target, tile.hexIndex)
						break
					case MouseButton.Right:
						dockview.api.addPanel({
							id: `selectionInfo.${crypto.randomUUID()}`,
							component: 'selectionInfo',
							title: axial.toString(hKey),
							params: {
								game: Object.entries(games).find(([k, v]) => v === game)?.[0],
								hKey: hKey,
							},
							floating: true,
						})
						break
				}
		}
	})
	game.addEntity(cursor)

	return game
}
