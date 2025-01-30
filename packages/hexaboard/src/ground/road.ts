import { Object3D } from 'three'
import type { Sextuplet } from '~/types'
import { type Axial, type AxialKey, axial } from '~/utils'
import type { TileBase } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { Sector } from './sector'

export type RoadKey = PropertyKey

export interface RoadBase {
	width: number
}

export interface RoadTile extends TileBase {
	roads: Sextuplet<RoadKey | undefined>
}

const hardCoded = new Map<AxialKey, Sextuplet<RoadKey | undefined>>([
	[axial.key({ q: 0, r: 0 }), ['hc', undefined, undefined, undefined, undefined, undefined]],
	[axial.key({ q: 1, r: 0 }), ['hc', undefined, undefined, 'hc', undefined, undefined]],
	[axial.key({ q: 2, r: 0 }), [undefined, undefined, undefined, 'hc', undefined, 'hc']],
	[axial.key({ q: 3, r: -1 }), [undefined, undefined, 'hc', 'hc', undefined, undefined]],
	[axial.key({ q: 2, r: -1 }), ['hc', undefined, undefined, undefined, undefined, undefined]],
])

export abstract class RoadGrid<Tile extends RoadTile> implements Landscape<Tile> {
	mouseReactive = false // TODO - mouse reactive roads
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const roadTriangles = triangles.filter((t) =>
			t.points.some((p) => sector.tiles.get(p.key)?.roads.some((r) => r !== undefined))
		)
		if (!roadTriangles.length) return new Object3D()
		// TODO: generate the indexing for mouse handling
		const mesh = this.createPartialMesh(sector, roadTriangles)
		mesh.renderOrder = 1 // Render over terrain (who is by default renderOrder 0)
		return mesh
	}
	abstract createPartialMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
	refineTile(tile: TileBase, point: Axial): Tile {
		return {
			...tile,
			roads: hardCoded.get(point.key) ?? (new Array(6) as Sextuplet<undefined>),
		} as Tile
	}
}
