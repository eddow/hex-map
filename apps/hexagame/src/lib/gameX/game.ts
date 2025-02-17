import { Color3, type Mesh } from '@babylonjs/core'
import {
	type ColorTile,
	ContinuousColorLandscape,
	Game,
	type GameView,
	InputMode,
	Land,
	Landscaper,
	OceanLandscape,
	type TerrainTile,
	TileHandle,
	axial,
	debugHole,
	handledActions,
	pointActions,
	viewActions,
} from 'hexaboard'
import { debugInfo, dockview } from '../globals.svelte'
import { type GameXActions, inputsConfiguration } from './inputs'
import { seaLevel, terrainFactory } from './world/transition'

export type GameXTile = ColorTile & TerrainTile
export type GameXLand = Land<GameXTile>

const navigationMode = new InputMode<GameXActions>(
	pointActions({
		zoom(point, event) {
			event.gameView.zoom(point, event.delta, { min: 150, max: 100 })
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
export default class GameX extends Game {
	cursor: Mesh
	selectionMode = new InputMode<GameXActions>(
		handledActions(TileHandle)<GameXActions>({
			select(target, event) {
				dockview.api.addPanel({
					id: `selectionInfo.${crypto.randomUUID()}`,
					component: 'selectionInfo',
					title: axial.toString(target.point),
					params: {
						hKey: target.point.key,
					},
					floating: true,
				})
			},
			hover: (tile, event) => {
				this.cursor.setEnabled(true)
				this.cursor.position = tile.position
				debugInfo.tile = tile.point
			},
		}),
		viewActions({
			hover: () => {
				this.cursor.setEnabled(false)
				debugInfo.tile = undefined
			},
		})
	)
	constructor(gameView: GameView, seed: number) {
		const { scene } = gameView
		super(
			gameView,
			new Land<GameXTile>(gameView, debugHole ? 0 : 5, 20),
			inputsConfiguration,
			navigationMode
		)
		this.cursor = this.meshUtils.icosahedron('cursor', 20, {
			emissiveColor: new Color3(1, 1, 1),
			wireframe: true,
		})
		this.cursor.setEnabled(false)
		this.cursor.isPickable = false

		scene.onBeforeRenderObservable.add(() => {
			this.cursor.rotation.x += 0.01
		})
		this.inputInteraction.setMode(this.selectionMode)
		const { land } = this
		land.addPart(
			terrainFactory(seed),

			new Landscaper<GameXTile>(
				new ContinuousColorLandscape<GameXTile>(this),
				//landscape as Landscape<GameXTile>,
				//new Rivers<GameXTile>(land, seed, seaLevel, terrainHeight, 96, 0.03),
				//grid,
				new OceanLandscape<GameXTile>(this, seaLevel)
			)
			//new Resourceful(terrainTypes, seed, s
		)
	}
}
/*
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
	}*/
//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
//const pawn = new Character(land.sector, 0, new Object3D())
//game.addEntity(pawn)
/*function markPath(path?: AxialRef[] | null, radius = 2) {
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

	let pathTube: Object3D | undefined*/
