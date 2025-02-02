import type { Face, Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game'
import { MouseHandle } from '~/mouse'
import type { Triplet } from '~/types'
import { Eventful } from '~/utils'
import { type Axial, type AxialCoord, axial } from '~/utils/axial'
import type { LandPart, RenderedEvents, TileBase, TileUpdater, WalkTimeSpecification } from './land'
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
		game: Game<Tile>,
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

// TODO: mouseHandler should be between here and Color/Terxure-Landscape (complete landscapes)
function sectorMouseHandler<Tile extends TileBase>(
	geometryVertex: AxialCoord[],
	center: AxialCoord
) {
	return function mouseHandle(
		game: Game<Tile>,
		target: any,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): TileHandle<Tile> {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileRef = axial.linear(center, geometryVertex[geomPt])
		// @ts-ignore Game<TileBase>
		return new TileHandle(game, target, axial.coordAccess(tileRef))
	}
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
export class Landscaper<Tile extends TileBase>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile, unknown[]>
{
	private readonly landscapes: Landscape<Tile>[]
	private readonly triangles: LandscapeTriangle<AxialCoord>[] = []
	private readonly geometryVertex: AxialCoord[] = []
	private readonly invalidated = new Map<Sector<Tile>, Set<LandPart<Tile>>>()

	/**
	 *
	 * @param sectorRadius
	 * @param landscapes The order matters as it will set the render order (latter landscapes will be rendered on top)
	 */
	constructor(sectorRadius: number, ...landscapes: Landscape<Tile>[]) {
		super()
		this.landscapes = landscapes
		for (const triangle of sectorTriangles(sectorRadius - 1)) {
			this.triangles.push(triangle)
			this.geometryVertex.push(...triangle.points)
		}
		for (const landscape of landscapes) {
			landscape.on('invalidatedRender', (landscape, sector) => {
				if (!this.invalidated.has(sector)) this.invalidated.set(sector, new Set())
				this.invalidated.get(sector)!.add(landscape)
				this.emit('invalidatedRender', this, sector)
			})
		}
	}
	renderSector(sector: Sector<Tile>): void {
		const mouseHandler = sectorMouseHandler(this.geometryVertex, sector.center)
		const sectorTriangles = centeredTriangles(this.triangles, sector.center)
		const invalidated = this.invalidated.get(sector) as Set<Landscape<Tile>>
		if (invalidated) this.invalidated.delete(sector)
		for (const landscape of invalidated ?? this.landscapes) {
			landscape.renderSector?.(sector)
			const o3d = landscape.createMesh(sector, sectorTriangles)
			o3d.renderOrder = this.landscapes.indexOf(landscape)
			if (landscape.mouseReactive) o3d.userData = { mouseHandler, mouseTarget: landscape }
			sector.add(landscape, o3d)
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

	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number {
		let rv = 1
		for (const landscape of this.landscapes)
			if (landscape.walkTimeMultiplier) {
				rv *= landscape.walkTimeMultiplier(movement) ?? 1
				if (Number.isNaN(rv)) return Number.NaN
			}
		return rv
	}
}
