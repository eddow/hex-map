import type { Face, Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game/game'
import { MouseHandle, type MouseReactive } from '~/utils'
import { type Axial, type HexIndex, type HexKey, axial, hexTiles } from '~/utils/axial'
import type { Land, LandPart, Sector, TileBase } from './land'

export type Triplet<T> = [T, T, T]
export interface Triangle {
	side: number
	indexes: Triplet<HexIndex>
}

export interface Landscape<Tile extends TileBase> {
	readonly mouseReactive: boolean
	render(tiles: Tile[], triangles: Triangle[]): Object3D
	refineTile?(tile: TileBase, coords: Axial): Tile
}

export class Tile1GHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(
		public readonly land: Land<Tile>,
		public readonly aKey: HexKey
	) {
		super()
	}
	get tile() {
		return this.land.getTile(this.aKey)
	}
	equals(other: Tile1GHandle): boolean {
		return this.aKey === other.aKey
	}
}

class SectorMouseHandler<Tile extends TileBase> implements MouseReactive<Tile1GHandle<Tile>> {
	constructor(
		private readonly land: Land<Tile>,
		private readonly geometryVertex: HexIndex[],
		private readonly center: Axial
	) {}
	mouseHandle(
		game: Game,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): Tile1GHandle<Tile> {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileRef = axial.linear(this.center, this.geometryVertex[geomPt])
		return new Tile1GHandle(this.land, axial.key(tileRef))
	}
}

function* sectorTriangles(radius: number) {
	let [htR, htRm1] = [0, 0]
	for (let ring = 1; ring < radius; ring++) {
		htRm1 = htR
		htR = hexTiles(ring)
		for (let side = 0; side < 6; side++) {
			for (let offset = 0; offset < ring; offset++) {
				const index1 = htR + side * ring + offset
				const index2 = htR + ((side * ring + offset + 1) % (6 * ring))
				const index3 = ring === 1 ? 0 : htRm1 + ((side * (ring - 1) + offset) % (6 * (ring - 1)))
				yield [index1, index3, index2, side]
				if (offset > 0) {
					const index4 = htRm1 + ((side * (ring - 1) + offset - 1) % (6 * (ring - 1)))
					yield [index1, index4, index3, (side + 1) % 6]
				}
			}
		}
	}
}

export class Landscaper<Tile extends TileBase> implements LandPart<Tile> {
	private readonly landscapes: Landscape<Tile>[]
	private readonly triangles: Triangle[] = []
	private readonly geometryVertex: HexIndex[] = []

	constructor(
		private readonly land: Land<Tile>,
		...landscapes: Landscape<Tile>[]
	) {
		this.landscapes = landscapes
		land.addPart(this)
		for (const [A, B, C, s] of sectorTriangles(land.sectorRadius)) {
			this.triangles.push({ side: s, indexes: [A, B, C] })
			this.geometryVertex.push(A, B, C)
		}
	}
	renderSector(sector: Sector<Tile>, tiles: Tile[]): void {
		const mouseHandler = new SectorMouseHandler(this.land, this.geometryVertex, sector.center)
		for (const landscape of this.landscapes) {
			const o3d = landscape.render(tiles, this.triangles)
			if (landscape.mouseReactive) o3d.userData = { mouseHandler }
			sector.group.add(o3d)
		}
	}

	refineTile(tile: TileBase, coords: Axial): Tile {
		for (const landscape of this.landscapes) tile = landscape.refineTile?.(tile, coords) ?? tile
		return tile as Tile
	}
}
