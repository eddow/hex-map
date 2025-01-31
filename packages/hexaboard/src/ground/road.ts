import type { Intersection, Object3D, Object3DEventMap } from 'three'
import type { Game } from '~/game'
import { MouseHandle, type MouseHandler } from '~/mouse'
import type { Sextuplet } from '~/types'
import { assert, type Axial, type AxialDirection, type AxialRef, AxialSet, axial } from '~/utils'
import { cached } from '~/utils/decorators'
import type { Land, TileBase } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
import { PartialLandscape } from './partialLandscape'
import type { ContentTile, TileContent } from './resourceful'
import type { Sector } from './sector'

export type RoadKey = PropertyKey

export interface RoadBase extends TileContent {
	width: number
}

export interface RoadTile extends TileBase {
	roads: Sextuplet<RoadKey | undefined>
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
	public readonly points: [Axial, Axial] | [Axial]
	constructor(game: Game<Tile>, target: any, points: [AxialRef, AxialRef] | [AxialRef]) {
		super(game, target)
		this.points = points.map(axial.access).sort((a, b) => a.key - b.key) as [Axial, Axial]
	}
	@cached()
	get tiles() {
		return this.points.map((p) => this.game.land.tile(p)) as [Tile, Tile] | [Tile]
	}
	@cached()
	get directions(): [AxialDirection, AxialDirection] | null {
		if (this.points.length === 1) return null
		const dir0 = axial.neighborIndex(this.points[1], this.points[0])
		assert(typeof dir0 === 'number', 'RoadHandle handles neighbors only')
		return [dir0, ((dir0 + 3) % 6) as AxialDirection]
	}
	get roadType() {
		// Content will be null when we will take the 1-point case in `mouseHandler`
		return this.tiles[0].content![this.directions![0]!] as RoadContent<Road>
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

export abstract class RoadGrid<Tile extends ContentTile, Road extends RoadBase>
	extends PartialLandscape<Tile, RoadHandle<Tile, Road>>
	implements Landscape<Tile>
{
	private roadIndex: Record<RoadKey, RoadContent<Road>> = {}
	constructor(
		protected readonly land: Land<Tile>,
		protected readonly roadDefinition: Record<RoadKey, Road>
	) {
		super()
		for (const [key, road] of Object.entries(this.roadDefinition)) {
			this.roadIndex[key] = new RoadContent(key, road)
		}
	}

	filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean {
		const roadPoints = new AxialSet(
			sector.tiles
				.entries()
				.filter(([k, t]) => t.content?.some((r) => r instanceof RoadContent))
				.map(([k, t]) => k)
		)
		return (t) => t.points.some((p) => roadPoints.has(p.key))
	}
	mouseHandler(sector: Sector<Tile>): MouseHandler<RoadHandle<Tile>> {
		return (
			sender,
			target: any,
			intersection: Intersection<Object3D<Object3DEventMap>>
		): RoadHandle<Tile, Road> | undefined => {
			const game = sender as Game<Tile>
			const baryArr = intersection.barycoord!.toArray()

			const keys = this.axialKeys(intersection.face!.a)
			const points = keys.map((k) => axial.keyAccess(k))
			const tiles = points.map((p) => game.land.tile(p))
			let minProximity = 1 // Greater than 1 is not in a road
			let minDirection: number
			let minFrom: Axial
			let minTo: Axial
			let direction = axial.neighborIndex(points[1], points[0]) as number
			for (let p = 0; p < 3; p++) {
				direction = (direction + 2) % 6
				const next = (p + 1) % 3
				const content = tiles[next].content?.[direction]
				// We calculate the "scaled-in-road": from 0-1, it's in the road. So, it's bary(0-1)/roadWidth
				if (content instanceof RoadContent) {
					const scaledInRoad = baryArr[p] / content.road.width
					if (scaledInRoad < minProximity) {
						minProximity = scaledInRoad
						minDirection = direction
						minFrom = points[next]
						minTo = points[(next + 1) % 3]
					}
				}
			}
			if (minProximity < 1) return new RoadHandle(game, target, [minFrom!, minTo!])
		}
	}
	link(A: Axial, B: Axial, road?: RoadKey): void {
		const sectors = new Set<Sector<Tile>>()
		const AtoB = axial.neighborIndex(A, B)
		assert(
			AtoB !== undefined && AtoB !== null,
			`Linked tiles ${A.key} and ${B.key} are not neighbors`
		)
		const tiles = { A: this.land.tile(A), B: this.land.tile(B) }
		for (const sector of [...tiles.A.sectors, ...tiles.B.sectors]) {
			if (sector.tiles.has(A.key) || sector.tiles.has(B.key)) sectors.add(sector)
		}
		tiles.A.content ??= []
		tiles.A.content[1 + ((AtoB + 3) % 6)] = road ? this.roadIndex[road] : undefined
		tiles.B.content ??= []
		tiles.B.content[1 + AtoB] = road ? this.roadIndex[road] : undefined
		for (const sector of sectors) {
			this.emit('invalidatedRender', this, sector)
		}
	}
}
