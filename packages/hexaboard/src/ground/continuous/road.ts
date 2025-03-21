import { MouseHandle } from '~/input'
import type { Triplet } from '~/types'
import { assert, type Axial, type AxialDirection, type AxialRef, AxialSet, axial } from '~/utils'
import { cached } from '~/utils/decorators'
import type { Land } from '../land'
import type { Sector } from '../sector'
import type { LandscapeTriangle } from './landscape'
import { ContinuousPartialLandscape } from './partialLandscape'
import { type ContentTile, type TileContent, getTileContent, setTileContent } from './resourceful'

export type RoadKey = PropertyKey

export interface RoadBase extends TileContent {
	width: number
}

export class RoadContent<Road extends RoadBase> implements TileContent {
	constructor(
		public key: RoadKey,
		public road: Road
	) {}
	get walkTimeMultiplier() {
		return this.road.walkTimeMultiplier
	}
}

export class RoadHandle<
	Tile extends ContentTile = ContentTile,
	Road extends RoadBase = RoadBase,
> extends MouseHandle {
	public readonly points: [Axial, Axial]
	constructor(
		target: any,
		private readonly sector: Sector<Tile>,
		points: [AxialRef, AxialRef]
	) {
		super(target)
		this.points = points.map(axial.access).sort((a, b) => a.key - b.key) as [Axial, Axial]
	}
	@cached()
	get tiles() {
		return this.points.map((p) => this.sector.tile(p)) as [Tile, Tile]
	}
	@cached()
	get directions(): [AxialDirection, AxialDirection] | null {
		const dir0 = axial.neighborIndex(this.points[1], this.points[0])
		assert(typeof dir0 === 'number', 'RoadHandle handles neighbors only')
		return [dir0, ((dir0 + 3) % 6) as AxialDirection]
	}
	get roadType() {
		// Content will be null when we will take the 1-point case in `mouseHandler`
		return getTileContent(this.tiles[0], this.directions![0]!) as RoadContent<Road>
	}
	equals(other: MouseHandle): boolean {
		return (
			other instanceof RoadHandle &&
			this.points.length === other.points.length &&
			// The points are ordered by key
			this.points.every((p, i) => p.key === other.points[i].key)
		)
	}
}

export abstract class RoadGrid<
	Tile extends ContentTile,
	Road extends RoadBase,
> extends ContinuousPartialLandscape<Tile> {
	private roadIndex: Record<RoadKey, RoadContent<Road>> = {}
	constructor(
		sectorRadius: number,
		protected readonly roadDefinition: Record<RoadKey, Road>
	) {
		super(sectorRadius)
		for (const [key, road] of Object.entries(this.roadDefinition)) {
			this.roadIndex[key] = new RoadContent(key, road)
		}
	}

	filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean {
		const roadPoints = new AxialSet(
			Array.from(sector.tiles.entries())
				.filter(([k, t]) => getTileContent(t, null) instanceof RoadContent)
				.map(([k, t]) => k)
		)
		return (t) => t.points.some((p) => roadPoints.has(p.key))
	}
	mouseHandler(sector: Sector<Tile>, points: Triplet<Axial>, bary: Triplet<number>) {
		const tiles = points.map((p) => sector.tiles.get(p))
		let min:
			| {
					proximity: number
					from: Axial
					to: Axial
			  }
			| undefined
		let direction = axial.neighborIndex(points[1], points[0]) as number
		for (let p = 0; p < 3; p++) {
			direction = (direction + 2) % 6
			const next = (p + 1) % 3
			const content = getTileContent(tiles[next]!, direction as AxialDirection)
			// We calculate the "scaled-in-road": from 0-1, it's in the road. So, it's bary(0-1)/roadWidth
			if (content instanceof RoadContent) {
				const scaledInRoad = bary[p] / (content.road.width * 2)
				if (scaledInRoad < (min?.proximity ?? 1))
					min = {
						proximity: scaledInRoad,
						from: points[next],
						to: points[(next + 1) % 3],
					}
			}
		}

		if (min) return new RoadHandle(this, sector, [min.from, min.to])
	}
	link(land: Land<Tile>, A: Axial, B: Axial, road?: RoadKey): void {
		const sectors = new Set<Sector<Tile>>()
		const roadContent = road ? this.roadIndex[road] : undefined
		const AtoB = axial.neighborIndex(A, B)
		assert(
			AtoB !== undefined && AtoB !== null,
			`Linked tiles ${A.key} and ${B.key} are not neighbors`
		)
		const tiles = { A: land.tile(A), B: land.tile(B) }
		for (const sector of [...tiles.A.sectors, ...tiles.B.sectors]) {
			if (sector.tiles.has(A.key) || sector.tiles.has(B.key)) sectors.add(sector)
		}
		setTileContent(tiles.A, AtoB + 3, roadContent)
		setTileContent(tiles.B, AtoB, roadContent)
		// TODO: Road priority -> only set if max - if downgrading, check the max(priority) in all the roads
		setTileContent(tiles.A, null, roadContent)
		setTileContent(tiles.B, null, roadContent)
		for (const sector of sectors) {
			this.emit('invalidatedRender', this, sector)
			// TODO: invalidate Resourceful?
		}
	}
}
