import type { Face, Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game/game'
import type { Triplet } from '~/types'
import { MouseHandle, type MouseReactive } from '~/utils'
import { type Axial, type AxialKey, axial, hexSides } from '~/utils/axial'
import type { Land, LandPart, TileBase, TileUpdater } from './land'
import type { Sector } from './sector'

export interface LandscapeTriangle {
	side: number
	coords: Triplet<Axial>
}

export interface Landscape<Tile extends TileBase, GenerationInfo = unknown>
	extends LandPart<Tile, GenerationInfo> {
	readonly mouseReactive: boolean
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
}

export class TileHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(
		public readonly game: Game,
		public readonly land: Land<Tile>,
		public readonly hKey: AxialKey
	) {
		super()
	}
	get tile() {
		return this.land.tile(this.hKey)
	}
	equals(other: TileHandle): boolean {
		return this.hKey === other.hKey
	}
}

class SectorMouseHandler<Tile extends TileBase> implements MouseReactive<TileHandle<Tile>> {
	constructor(
		private readonly land: Land<Tile>,
		private readonly geometryVertex: Axial[],
		private readonly center: Axial
	) {}
	mouseHandle(
		game: Game,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): TileHandle<Tile> {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileRef = axial.linear(this.center, this.geometryVertex[geomPt])
		return new TileHandle(game, this.land, axial.key(tileRef))
	}
}

function centricIndex(hexIndex: number): Axial {
	if (hexIndex === 0) return { q: 0, r: 0 }
	const radius = Math.floor((3 + Math.sqrt(-3 + 12 * hexIndex)) / 6)
	const previous = 3 * radius * (radius - 1) + 1
	const sidePos = hexIndex - previous
	const side = Math.floor(sidePos / radius)
	return axial.linear([radius, hexSides[side]], [sidePos % radius, hexSides[(side + 2) % 6]])
}

function* sectorTriangles(maxAxialDistance: number): Generator<LandscapeTriangle> {
	for (let r = -maxAxialDistance; r < maxAxialDistance; r++) {
		const qFrom = Math.max(1 - maxAxialDistance, -r - maxAxialDistance)
		const qTo = Math.min(maxAxialDistance, -r + maxAxialDistance)
		if (r < 0) {
			yield {
				side: 0,
				coords: [
					{ q: qTo, r },
					{ q: qTo, r: r + 1 },
					{ q: qTo - 1, r: r + 1 },
				],
			}
		} else {
			yield {
				side: 1,
				coords: [
					{ q: qFrom - 1, r },
					{ q: qFrom, r },
					{ q: qFrom - 1, r: r + 1 },
				],
			}
		}
		for (let q = qFrom; q < qTo; q++) {
			yield {
				side: 0,
				coords: [
					{ q, r },
					{ q, r: r + 1 },
					{ q: q - 1, r: r + 1 },
				],
			}
			yield {
				side: 1,
				coords: [
					{ q, r },
					{ q: q + 1, r },
					{ q: q, r: r + 1 },
				],
			}
		}
	}
}

function centeredTriangles(
	triangles: Iterable<LandscapeTriangle>,
	center: Axial
): LandscapeTriangle[] {
	const rv: LandscapeTriangle[] = []
	for (const triangle of triangles)
		rv.push({
			...triangle,
			coords: triangle.coords.map((coord) => axial.linear(center, coord)) as Triplet<Axial>,
		})
	return rv
}
/**
 * Provide triangle management for the landscape
 */
export class Landscaper<Tile extends TileBase> implements LandPart<Tile, unknown[]> {
	private readonly landscapes: Landscape<Tile>[]
	private readonly triangles: LandscapeTriangle[] = []
	private readonly geometryVertex: Axial[] = []

	constructor(
		private readonly land: Land<Tile>,
		...landscapes: Landscape<Tile>[]
	) {
		this.landscapes = landscapes
		land.addPart(this)
		for (const triangle of sectorTriangles(land.sectorRadius - 1)) {
			this.triangles.push(triangle)
			this.geometryVertex.push(...triangle.coords)
		}
	}
	renderSector(sector: Sector<Tile>): void {
		const mouseHandler = new SectorMouseHandler(this.land, this.geometryVertex, sector.center)
		const sectorTriangles = centeredTriangles(this.triangles, sector.center)
		for (const landscape of this.landscapes) {
			landscape.renderSector?.(sector)
			const o3d = landscape.createMesh(sector, sectorTriangles)
			if (landscape.mouseReactive) o3d.userData = { mouseHandler }
			sector.add(o3d)
		}
	}

	beginGeneration() {
		return this.landscapes.map((landscape) => landscape?.beginGeneration?.())
	}
	/**
	 *
	 * @param generationInfo Allows this part to spread generative modifications across multiple sectors
	 * @param updateTile Function to call when a tile is modified
	 */
	spreadGeneration?(updateTile: TileUpdater<Tile>, generationInfo: unknown[]): void {
		for (let i = 0; i < this.landscapes.length; i++)
			this.landscapes[i].spreadGeneration?.(updateTile, generationInfo[i])
	}

	refineTile(tile: TileBase, coord: Axial, generationInfo: unknown[]): Tile {
		for (let i = 0; i < this.landscapes.length; i++)
			tile = this.landscapes[i].refineTile?.(tile, coord, generationInfo[i]) ?? tile
		return tile as Tile
	}
}
