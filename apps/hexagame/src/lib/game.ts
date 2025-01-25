import * as m from '$lib/paraglide/messages'
import {
	Game,
	Land,
	Landscape,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	NatureGenerator,
	TextureGeometry,
	Tile1GHandle,
	TileCursor,
	TileHandle,
	axial,
	cartesian,
	icosahedron,
} from 'hexaboard'
import type { Object3D } from 'three'
import { OceanGeometry } from '~/ground/oceanGeometry'
import { debugInfo, dockview, games } from './globals.svelte'
import terrains, { seaLevel, terrainHeight } from './world/terrain'
type MapTuple<T extends any[], U> = {
	[K in keyof T]: U
}

/*type Terrain = ResourcefulTerrain & TexturedTerrain
type Tile = TileBase<Terrain>*/
const tileSize = 20

export function createGame(seed: number) {
	/*
	const landscape = new TexturedLandscape(20, terrains.textures)
	const procedural = new NoiseProcedural<Tile>(32, terrainHeight, 73058, 50)
	const seaLevel = terrainHeight / 2
	const land = new WateredLand({
		terrains,
		procedural,
		landscape,
		seed,
		tileRadius: 1,
		seaLevel,
	})*/
	/*
	function tileSpec(aRef: AxialRef) {
		return new TileSpec(land, axial.coords(aRef))
	}
	function tiled<Args extends TileSpec[], Return>(
		fct: (...tiles: Args) => Return
	): (...aRefs: MapTuple<Args, AxialRef>) => Return {
		// @ts-ignore
		return (...aRefs: MapTuple<Args, AxialRef>) => fct(...aRefs.map(tileSpec))
	}*/
	const natureGenerator = new NatureGenerator(terrainHeight, terrains, seed, tileSize, 50)
	const land = new Land(natureGenerator)

	const landscape = new Landscape(
		land,
		new TextureGeometry(terrains, seed),
		new OceanGeometry(seaLevel)
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
	game.onMouse('hover', (ev: MouseHoverEvolution) => {
		if (ev.handle instanceof Tile1GHandle) {
			cursor.tile = ev.handle

			if (pathTube) {
				game.scene.remove(pathTube)
				pathTube = undefined
			}
			//if (pawn.tile !== cursor.tile.hexIndex) {
			/*try {
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
			/*const path = costingPath(
					cursor.tile.axial,
					tiled(
						(from, to) =>
							Math.max(0, to.tile.z - from.tile.z) ** 2 +
							// The fact to not take the strongest down slope
							to.tile.z -
							Math.min(...pointsAround(from.axial).map((p) => tileSpec(p).tile.z))
					),
					(aRef) => tileSpec(aRef).tile.z < seaLevel
				)
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
			debugInfo.tile = axial.coords(cursor.tile?.aKey)
			debugInfo.tilePos = cartesian(debugInfo.tile, 20)
		} else {
			debugInfo.tilePos = debugInfo.tile = 'none'
			cursor.tile = undefined
		}
	})
	game.onMouse('click', (ev: MouseButtonEvolution) => {
		if (ev.handle instanceof TileHandle) {
			const tile = ev.handle?.spec
			const game = ev.handle?.game
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
								game: Object.entries(games).find(([k, v]) => v === game)?.[0],
								sector: tile.sector.key,
								hexIndex: tile.hexIndex,
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
