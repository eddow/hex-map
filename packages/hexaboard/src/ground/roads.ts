import type { Texture } from 'three'
import type { Sextuplet } from '~/types'
import { type Axial, type AxialKey, axial } from '~/utils'
import type { Land, LandPart, TileBase } from './land'

export type RoadKey = PropertyKey

export interface RoadBase {
	width: number
	blend: number
	color: { r: number; g: number; b: number }
}

export interface TextureRoad extends RoadBase {
	texture: Texture
	direction: 0 | 1 // Whether we go from 0.5-0 or 0.5-1
	x: number // Where in the (linear) texture
}

const hardCoded = new Map<AxialKey, Sextuplet<RoadKey | undefined>>([
	[axial.key({ q: 0, r: 0 }), ['hc', undefined, undefined, undefined, undefined, undefined]],
	[axial.key({ q: 1, r: 0 }), ['hc', undefined, undefined, 'hc', undefined, undefined]],
	[axial.key({ q: 2, r: 0 }), [undefined, undefined, undefined, 'hc', undefined, 'hc']],
	[axial.key({ q: 3, r: -1 }), [undefined, undefined, 'hc', 'hc', undefined, undefined]],
	[axial.key({ q: 2, r: -1 }), ['hc', undefined, undefined, undefined, undefined, undefined]],
])

export interface RoadTile<Road extends RoadBase = RoadBase> extends TileBase {
	roads: Sextuplet<RoadKey | undefined>
}

export class GridTerrain<Road extends RoadBase = RoadBase> implements LandPart<RoadTile<Road>> {
	constructor(private readonly land: Land<TileBase>) {
		land.addPart(this)
	}
	refineTile(tile: TileBase, point: Axial): RoadTile<Road> {
		return {
			...tile,
			roads: hardCoded.get(point.key) ?? (new Array(6) as Sextuplet<undefined>),
		}
	}
}
