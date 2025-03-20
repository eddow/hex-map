import {
	type AxialRef,
	ContinuousTextureLandscape,
	Game,
	InputInteraction,
	InputMode,
	Land,
	Landscaper,
	OceanLandscape,
	Resourceful,
	type SeamlessTextureTerrain,
	TileCursor,
	TileHandle,
	axial,
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
import { type HexClashActions, inputsConfiguration } from './inputs'
import { type HexClashTile, seaLevel, terrainTypes } from './world/terrain'
import { terrainFactory } from '$lib/gameX/world/terrain'

export function createGame(name: string, seed: number) {
	const cursor = new TileCursor(
		icosahedron(20, {
			color: 0xffffff,
			wireframe: true,
		})
	)

	const navigationMode = new InputMode<HexClashActions>(
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
	const selectionMode = new InputMode<HexClashActions>(
		handledActions(TileHandle)<HexClashActions>({
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

	const gameInputInteraction = new InputInteraction<HexClashActions>(
		inputsConfiguration,
		navigationMode,
		selectionMode
	)
	const land = new Land<HexClashTile>(5, 20, 0)
	const landscape = new ContinuousTextureLandscape<HexClashTile, SeamlessTextureTerrain>(
		land.sectorRadius,
		terrainTypes,
		textureStyle.seamless(2)
	)
	//const grid = new ColorRoadGrid(land.sectorRadius, roadTypes)
	land.addPart(
		terrainFactory(seed),
		new Landscaper<HexClashTile>(
			landscape /*, grid*/,
			new OceanLandscape<HexClashTile>(land.sectorRadius, seaLevel)
		),
		new Resourceful(terrainTypes, seed)
	)

	const game = new Game(land, gameInputInteraction)
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
	game.addEntity(cursor)

	return game
}
