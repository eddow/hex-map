import {
	type AxialRef,
	ColorRoadGrid,
	type ContentTile,
	ContinuousTextureLandscape,
	Game,
	HeightTerrain,
	Land,
	type Landscape,
	Landscaper,
	MouseButton,
	type MouseButtonEvolution,
	type MouseDragEvolution,
	type MouseHoverEvolution,
	OceanLandscape,
	PerlinHeight,
	Resourceful,
	type RiverTile,
	Rivers,
	type RoadHandle,
	TileCursor,
	TileHandle,
	axial,
	costingPath,
	icosahedron,
} from 'hexaboard'
import {
	CatmullRomCurve3,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	TubeGeometry,
	Vector3,
} from 'three'
import { debugInfo, dockview, games } from './globals.svelte'
import { roadTypes, seaLevel, terrainHeight, terrains } from './world/textures'

export type GameXTile = ContentTile & RiverTile
export type GameXLand = Land<GameXTile>

export function createGame(seed: number) {
	const land = new Land<GameXTile>(4, 20)
	const landscape = new ContinuousTextureLandscape<GameXTile>(
		land.sectorRadius,
		terrains,
		roadTypes,
		seed
	)
	const grid = new ColorRoadGrid(land.sectorRadius, roadTypes)
	land.addPart(
		new PerlinHeight<GameXTile>(terrainHeight, seed, 1000),
		new HeightTerrain<GameXTile>(terrainHeight / 10, seed, terrains, 1000),

		new Landscaper<GameXTile>(
			new Rivers<GameXTile>(land, seed, seaLevel, terrainHeight, 96, 0.03),
			landscape as Landscape<GameXTile>,
			grid,
			new OceanLandscape<GameXTile>(land.sectorRadius, seaLevel)
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

	function markPath(path?: AxialRef[] | null, radius = 2) {
		if (pathTube) {
			game.scene.remove(pathTube)
			pathTube = undefined
		}
		if (path && path.length > 1) {
			const pathCurve = new CatmullRomCurve3(
				path.map((p) => new Vector3().copy(land.tile(p).position))
			)
			const pathGeometry = new TubeGeometry(pathCurve, path.length * 5, radius, 8, false)
			const pathMaterial = new MeshBasicMaterial({ color: 0xffff00, wireframe: true })
			pathTube = new Mesh(pathGeometry, pathMaterial)
			game.scene.add(pathTube)
		}
	}

	let pathTube: Object3D | undefined
	grid.on({
		'mouse:hover'(ev: MouseHoverEvolution<RoadHandle<GameXTile>>) {
			markPath(ev.handle.points, 2 * land.tileSize * ev.handle.roadType.road.width)
		},
		'mouse:leave'() {
			markPath()
		},
	})
	landscape.on({
		'mouse:hover'(ev: MouseHoverEvolution<TileHandle<GameXTile>>) {
			cursor.tile = ev.handle

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
			debugInfo.riverHeight = tile.riverHeight
		},
		'mouse:leave'() {
			cursor.tile = undefined
			debugInfo.axial = undefined
			debugInfo.tilePos = undefined
		},
		'mouse:dragOver'(ev: MouseDragEvolution<TileHandle>) {
			const src = ev.drag.handle
			const dst = ev.handle.point.key
			if (src instanceof TileHandle) {
				const path = costingPath(src.point, Land.walkCost(land), (at) => at.key === dst)
				markPath(path)
			}
		},
		'mouse:dragCancel': (ev: MouseDragEvolution<TileHandle>) => {
			markPath()
		},
		'mouse:dragDrop': (ev: MouseDragEvolution<TileHandle>) => {
			markPath()
			const src = ev.drag.handle
			const dst = ev.handle.point.key
			if (src instanceof TileHandle) {
				const path = costingPath(src.point, Land.walkCost(land), (at) => at.key === dst)
				if (path)
					for (let step = 1; step < path.length; step++) {
						grid.link(land, path[step - 1], path[step], 'hc')
					}
			}
		},
	})
	game.on('mouse:click', (ev: MouseButtonEvolution) => {
		if (ev.handle instanceof TileHandle) {
			const hKey = ev.handle?.point.key
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
