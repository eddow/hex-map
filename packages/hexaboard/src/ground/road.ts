import { Object3D } from 'three'
import type { Sextuplet } from '~/types'
import { assert, type Axial, Eventful, axial } from '~/utils'
import type { Land, RenderedEvent, TileBase } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
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

export abstract class RoadGrid<Tile extends ContentTile, Road extends RoadBase>
	extends Eventful<RenderedEvent<Tile>>
	implements Landscape<Tile>
{
	mouseReactive = false // TODO - mouse reactive roads
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
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const roadTriangles = triangles.filter((t) =>
			t.points.some((p) => sector.tiles.get(p.key)?.content?.some((r) => r instanceof RoadContent))
		)
		if (!roadTriangles.length) return new Object3D()
		// TODO: generate the indexing for mouse handling
		// TODO: Generalize this for even ocean and rivers (partial landscapes)
		const mesh = this.createPartialMesh(sector, roadTriangles)
		return mesh
	}
	abstract createPartialMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
	link(A: Axial, B: Axial, road?: RoadKey): void {
		const AtoB = axial.neighborIndex(A, B)
		assert(AtoB, `Linked tiles ${A.key} and ${B.key} are not neighbors`)
		const tiles = { A: this.land.tile(A), B: this.land.tile(B) }
		tiles.A.content ??= []
		tiles.A.content[1 + ((AtoB + 3) % 6)] = road ? this.roadIndex[road] : undefined
		tiles.B.content ??= []
		tiles.B.content[1 + AtoB] = road ? this.roadIndex[road] : undefined
		// TODO: invalidate mesh
	}
}
