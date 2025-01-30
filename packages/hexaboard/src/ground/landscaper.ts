import type { Face, Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game'
import { MouseHandle, type MouseReactive } from '~/mouse'
import type { Triplet } from '~/types'
import { type Axial, type AxialCoord, axial, hexSides } from '~/utils/axial'
import type { LandPart, TileBase, TileUpdater } from './land'
import type { Sector } from './sector'

export interface LandscapeTriangle<A extends AxialCoord = Axial> {
	side: 0 | 1
	points: Triplet<A>
}

export interface Landscape<Tile extends TileBase, GenerationInfo = unknown>
	extends LandPart<Tile, GenerationInfo> {
	readonly mouseReactive: boolean
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
}

export class TileHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(
		game: Game,
		target: any,
		public readonly point: Axial
	) {
		super(game, target)
	}
	get tile() {
		return this.land.tile(this.point.key) as Tile
	}
	equals(other: MouseHandle): boolean {
		return other instanceof TileHandle && this.point.key === other.point.key
	}
}

class SectorMouseHandler<Tile extends TileBase> implements MouseReactive<TileHandle<Tile>> {
	constructor(
		private readonly geometryVertex: AxialCoord[],
		private readonly center: AxialCoord
	) {}
	mouseHandle(
		game: Game,
		target: any,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): TileHandle<Tile> {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileRef = axial.linear(this.center, this.geometryVertex[geomPt])
		return new TileHandle(game, target, axial.coordAccess(tileRef))
	}
}

function centricIndex(hexIndex: number): AxialCoord {
	if (hexIndex === 0) return { q: 0, r: 0 }
	const radius = Math.floor((3 + Math.sqrt(-3 + 12 * hexIndex)) / 6)
	const previous = 3 * radius * (radius - 1) + 1
	const sidePos = hexIndex - previous
	const side = Math.floor(sidePos / radius)
	return axial.linear([radius, hexSides[side]], [sidePos % radius, hexSides[(side + 2) % 6]])
}

function* sectorTriangles(maxAxialDistance: number): Generator<LandscapeTriangle<AxialCoord>> {
	for (let r = -maxAxialDistance; r < maxAxialDistance; r++) {
		const qFrom = Math.max(1 - maxAxialDistance, -r - maxAxialDistance)
		const qTo = Math.min(maxAxialDistance, -r + maxAxialDistance)
		if (r < 0) {
			yield {
				side: 0,
				points: [
					{ q: qTo, r },
					{ q: qTo, r: r + 1 },
					{ q: qTo - 1, r: r + 1 },
				],
			}
		} else {
			yield {
				side: 1,
				points: [
					{ q: qFrom - 1, r },
					{ q: qFrom, r },
					{ q: qFrom - 1, r: r + 1 },
				],
			}
		}
		for (let q = qFrom; q < qTo; q++) {
			yield {
				side: 0,
				points: [
					{ q, r },
					{ q, r: r + 1 },
					{ q: q - 1, r: r + 1 },
				],
			}
			yield {
				side: 1,
				points: [
					{ q, r },
					{ q: q + 1, r },
					{ q: q, r: r + 1 },
				],
			}
		}
	}
}

function centeredTriangles(
	triangles: Iterable<LandscapeTriangle<AxialCoord>>,
	center: AxialCoord
): LandscapeTriangle[] {
	const rv: LandscapeTriangle[] = []
	for (const triangle of triangles)
		rv.push({
			...triangle,
			points: triangle.points.map((coord) =>
				axial.coordAccess(axial.linear(center, coord))
			) as Triplet<Axial>,
		})
	return rv
}
/**
 * Provide triangle management for the landscape
 */
export class Landscaper<Tile extends TileBase> implements LandPart<Tile, unknown[]> {
	private readonly landscapes: Landscape<Tile>[]
	private readonly triangles: LandscapeTriangle<AxialCoord>[] = []
	private readonly geometryVertex: AxialCoord[] = []

	constructor(sectorRadius: number, ...landscapes: Landscape<Tile>[]) {
		this.landscapes = landscapes
		for (const triangle of sectorTriangles(sectorRadius - 1)) {
			this.triangles.push(triangle)
			this.geometryVertex.push(...triangle.points)
		}
	}
	renderSector(sector: Sector<Tile>): void {
		const mouseHandler = new SectorMouseHandler(this.geometryVertex, sector.center)
		const sectorTriangles = centeredTriangles(this.triangles, sector.center)
		for (const landscape of this.landscapes) {
			landscape.renderSector?.(sector)
			const o3d = landscape.createMesh(sector, sectorTriangles)
			if (landscape.mouseReactive) o3d.userData = { mouseHandler, mouseTarget: landscape }
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
