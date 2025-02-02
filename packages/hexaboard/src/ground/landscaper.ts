import type { Face, Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game'
import { MouseHandle } from '~/mouse'
import { Eventful } from '~/utils'
import { type Axial, type AxialCoord, axial } from '~/utils/axial'
import type { LandPart, RenderedEvents, TileBase, TileUpdater, WalkTimeSpecification } from './land'
import type { Sector } from './sector'

export interface Landscape<Tile extends TileBase, GenerationInfo = unknown>
	extends LandPart<Tile, GenerationInfo> {
	createSector3D(sector: Sector<Tile>): Object3D
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
/**
 * Provide triangle management for the landscape
 */
export class Landscaper<Tile extends TileBase>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile, unknown[]>
{
	public static renderOrders = 0
	private readonly landscapes: Landscape<Tile>[]
	private readonly invalidated = new Map<Sector<Tile>, Set<LandPart<Tile>>>()

	/**
	 *
	 * @param sectorRadius
	 * @param landscapes The order matters as it will set the render order (latter landscapes will be rendered on top)
	 */
	constructor(...landscapes: Landscape<Tile>[]) {
		super()
		this.landscapes = landscapes
		for (const landscape of landscapes) {
			landscape.on('invalidatedRender', (landscape, sector) => {
				if (!this.invalidated.has(sector)) this.invalidated.set(sector, new Set())
				this.invalidated.get(sector)!.add(landscape)
				this.emit('invalidatedRender', this, sector)
			})
		}
	}
	renderSector(sector: Sector<Tile>): void {
		const invalidated = this.invalidated.get(sector) as Set<Landscape<Tile>>
		if (invalidated) this.invalidated.delete(sector)
		for (const landscape of invalidated ?? this.landscapes) {
			landscape.renderSector?.(sector)
			const o3d = landscape.createSector3D(sector)
			// TODO: traverse?
			o3d.renderOrder = Landscaper.renderOrders + this.landscapes.indexOf(landscape)
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
