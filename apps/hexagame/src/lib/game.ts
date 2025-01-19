import {
	type Axial,
	Character,
	Game,
	type HeightPowGen,
	Island,
	LCG,
	MonoSectorLand,
	MouseButton,
	type MouseButtonEvolution,
	type MouseHoverEvolution,
	TileCursor,
	axialIndex,
	costingPath,
	icosahedron,
	meshAsset,
	pointsAround,
} from 'hexaboard'
import { CatmullRomCurve3, Mesh, MeshBasicMaterial, Object3D, TubeGeometry, Vector3 } from 'three'
import { dockview } from './globals.svelte'
import terrains from './world/terrain'

let tileInfoPanels = 0
export function createGame(seed: number) {
	const worldSeed = Math.random()
	const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6, terrains))
	land.generate(LCG(worldSeed))
	land.virgin()
	land.mesh()

	const game = new Game(land)

	//const pawn = new Character(land.sector, 0, sphere(2, { color: 0xff0000 }))
	const pawn = new Character(land.sector, 0, new Object3D())
	game.addEntity(pawn)
	const cursor = new TileCursor(
		icosahedron(land.tileSize / Math.sqrt(3), {
			color: 0xffffff,
			wireframe: true,
		})
	) /*
	const mCopy = new MeshCopy(sphere(2, { color: 0x00ff00 }))
	const mTest = sphere(2, { color: 0x0000ff })
	const mPaste1 = new MeshPaste(mCopy)
	const mPaste2 = new MeshPaste(mCopy)
	mPaste1.position.set(0, 0, 20)
	mPaste2.position.set(10, 0, 80)
	mTest.position.set(-10, 0, 80)
	game.scene.add(mPaste1, mPaste2, mTest)*/
	const mTest = meshAsset('/assets/resource/rock1.glb')

	mTest.position.set(0, 0, 20)
	game.scene.add(mTest)

	function axialV3(axial: Axial | number) {
		return (game.land as MonoSectorLand).sector.vPosition(
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
			if (pawn.tile !== cursor.tile.hexIndex) {
				const sector = (game.land as MonoSectorLand).sector as HeightPowGen
				/* straight path
				const path = [
					axialAt(pawn.tile),
					...straightPath(pawn.sector, pawn.tile, cursor.tile.target, cursor.tile.hexIndex),
				]*/
				/* no height path (0 height diff still has horz mvt not counted)
				const path = costingPath(
					cursor.tile.hexIndex,
					(from, to) =>
						to < sector.nbrTiles ? (sector.points[from].z - sector.points[to].z) ** 2 : Number.NaN,
					(hexIndex) => hexIndex < sector.nbrTiles && pawn.tile === hexIndex
				)*/
				const path = costingPath(
					cursor.tile.hexIndex,
					(from, to) =>
						to < sector.nbrTiles
							? // The fact to climb up
								Math.max(0, sector.points[to].z - sector.points[from].z) ** 2 +
								// The fact to not take the strongest down slope
								sector.points[to].z -
								Math.min(...pointsAround(from, sector.nbrTiles).map((p) => sector.points[p].z))
							: Number.NaN,
					(hexIndex) => hexIndex < sector.nbrTiles && sector.points[hexIndex].z < 0
				)
				if (path && path.length > 1) {
					const pathCurve = new CatmullRomCurve3(path.map((p) => axialV3(p)))
					const pathGeometry = new TubeGeometry(pathCurve, path.length * 5, 2, 8, false)
					const pathMaterial = new MeshBasicMaterial({ color: 0xffff00, wireframe: true })
					pathTube = new Mesh(pathGeometry, pathMaterial)
					game.scene.add(pathTube)
				}
			}
		}
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
