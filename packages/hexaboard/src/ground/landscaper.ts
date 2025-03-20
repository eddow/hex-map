import type { Object3D } from 'three'
import { MouseHandle } from '~/input'
import { Eventful } from '~/utils'
import type { Axial } from '~/utils/axial'
import type { LandPart, RenderedEvents, TileBase, WalkTimeSpecification } from './land'
import type { Sector } from './sector'

export interface Landscape<Tile extends TileBase> extends LandPart<Tile> {
	createSector3D(sector: Sector<Tile>): Promise<Object3D>
}

export class TileHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(
		sender: any,
		private readonly sector: Sector<Tile>,
		public readonly point: Axial
	) {
		super(sender)
	}
	get tile() {
		return this.sector.tile(this.point) as Tile
	}
	equals(other: MouseHandle): boolean {
		return other instanceof TileHandle && this.point.key === other.point.key
	}
}
/**
 * Provide triangle management for the landscape
 */
export class Landscaper<Tile extends TileBase>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile>
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
	async renderSector(sector: Sector<Tile>) {
		const invalidated = this.invalidated.get(sector) as Set<Landscape<Tile>>
		if (invalidated) this.invalidated.delete(sector)
		for (const landscape of invalidated ?? this.landscapes) {
			landscape.renderSector?.(sector)
			const o3d = await landscape.createSector3D(sector)
			o3d.traverse((o: Object3D) => {
				o.renderOrder = Landscaper.renderOrders + this.landscapes.indexOf(landscape)
			})

			sector.setPartO3d(landscape, o3d)
		}
	}

	refineTile(tile: TileBase, coord: Axial, tilePrecalc: Record<string, any>): Tile {
		for (let i = 0; i < this.landscapes.length; i++)
			tile = this.landscapes[i].refineTile?.(tile, coord, tilePrecalc) ?? tile
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
