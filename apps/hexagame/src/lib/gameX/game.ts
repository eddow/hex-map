import {
	type Axial,
	type AxialRef,
	ColorRoadGrid,
	type ContentTile,
	ContinuousTextureLandscape,
	Game,
	InputInteraction,
	InputMode,
	Land,
	type Landscape,
	Landscaper,
	OceanLandscape,
	Resourceful,
	type RiverTile,
	Rivers,
	type RoadKey,
	type SeamlessTextureTerrain,
	TileCursor,
	TileHandle,
	axial,
	costingPath,
	handledActions,
	icosahedron,
	pointActions,
	textureStyle,
	viewActions,
} from 'hexaboard'
import {
	CatmullRomCurve3,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	TubeGeometry,
	Vector3,
} from 'three'
import { dockview } from '../globals.svelte'
import { type GameXActions, inputsConfiguration } from './inputs'
import { roadTypes, seaLevel, terrainFactory, terrainHeight, terrainTypes } from './world/terrain'

export type GameXTile = ContentTile & RiverTile
export type GameXLand = Land<GameXTile>

export function createGame(name: string, seed: number) {
	const cursor = new TileCursor(
		icosahedron(20, {
			color: 0xffffff,
			wireframe: true,
		})
	)

	const navigationMode = new InputMode<GameXActions>(
		pointActions({
			zoom(point, event) {
				event.gameView.zoom(point, event.delta, { min: 150, max: 1000 })
			},
		}),
		viewActions({
			pan(event) {
				event.gameView.pan(event.delta)
			},
			turn(event) {
				event.gameView.turn(event.delta)
			},
		})
	)
	const selectionMode = new InputMode<GameXActions>(
		handledActions(TileHandle)<GameXActions>({
			select(target, event) {
				dockview.api.addPanel({
					id: `selectionInfo.${crypto.randomUUID()}`,
					component: 'selectionInfo',
					title: axial.toString(target.point),
					params: {
						game: name,
						hKey: target.point.key,
					},
					floating: true,
				})
			},
			hover(tile, event) {
				cursor.tile = event.buttonHoverType && event.keyModHoverType ? tile : undefined
			},
		}),
		viewActions({
			hover() {
				cursor.tile = undefined
			},
		})
	)
	// TODO: Make a drag-drop config helper
	function roadDrawMode(roadType: RoadKey) {
		let drawing: Axial | undefined
		let pathMarked: Axial | undefined
		let path: Axial[] | null = null
		function cancel() {
			if (path) markPath()
			drawing = undefined
			pathMarked = undefined
			path = null
		}
		return new InputMode<GameXActions>(
			handledActions(TileHandle)<GameXActions>({
				roadDraw(tile, event) {
					if (drawing && event.buttonHoverType !== 'cancel' && pathMarked !== tile.point)
						path = costingPath(drawing, Land.walkCost(land), (at) => at.key === tile.point.key)
					switch (event.buttonHoverType) {
						case 'drag':
							if (!drawing) {
								drawing = tile.point
							}
							cursor.tile = tile
							break
						case 'drop':
							if (drawing) {
								drawing = undefined
								if (path)
									for (let step = 1; step < path.length; step++) {
										grid.link(land, path[step - 1], path[step], roadType)
									}
							}
							cursor.tile = tile
							break
						case 'cancel': {
							cancel()
							break
						}
					}
					if (!drawing && pathMarked) {
						markPath()
						pathMarked = undefined
					}
					if (drawing && pathMarked?.key !== tile.point.key) {
						pathMarked = tile.point
						markPath(path)
					}
				},
			}),
			viewActions({
				roadDraw() {
					cancel()
					cursor.tile = undefined
				},
			})
		)
	}

	const gameInputInteraction = new InputInteraction<GameXActions>(
		inputsConfiguration,
		navigationMode,
		roadDrawMode('hc')
		//selectionMode
	)
	//DEBUG VALUE
	const land = new Land<GameXTile>(4, 20)
	//	const land = new Land<GameXTile>(2, 20)
	const landscape = new ContinuousTextureLandscape<GameXTile, SeamlessTextureTerrain>(
		land.sectorRadius,
		terrainTypes,
		textureStyle.seamless(3, seed)
	)
	const grid = new ColorRoadGrid(land.sectorRadius, roadTypes)
	land.addPart(
		terrainFactory(seed),

		new Landscaper<GameXTile>(
			new Rivers<GameXTile>(land, seed, seaLevel, terrainHeight, 96, 0.03),
			landscape as Landscape<GameXTile>,
			grid,
			new OceanLandscape<GameXTile>(land.sectorRadius, seaLevel)
		),
		new Resourceful(terrainTypes, seed, seaLevel)
	)

	const game = new Game(land, gameInputInteraction)

	//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	//const pawn = new Character(land.sector, 0, new Object3D())
	//game.addEntity(pawn)

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
	/*grid.on({
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
					axial.access(pawn.tile),
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
			}* /
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
	})*/
	game.addEntity(cursor)

	return game
}
