import type { Triplet } from '~/types'
import { assert, type Axial, type AxialCoord, axial } from '~/utils'
import type { TileBase } from '../land'
import type { Sector } from '../sector'
import {
	ContinuousLandscape,
	type LandscapeTriangle,
	type SectorElements,
	axialCoordIndex,
	sectorTriangles,
} from './landscape'

export abstract class ContinuousPartialLandscape<
	Tile extends TileBase,
> extends ContinuousLandscape<Tile> {
	private vertexMatch = new WeakMap<Sector<Tile>, SectorElements>()
	async getSectorElements(sector: Sector<Tile>): Promise<SectorElements> {
		const cached = this.vertexMatch.get(sector)
		if (cached) return cached
		const sectorRadius = this.game.land.sectorRadius
		const geometryVertex: AxialCoord[] = []
		const triangles = sectorTriangles(sectorRadius)
			.map((p) => ({
				...p,
				points: p.points.map((point) =>
					axial.coordAccess(axial.linear(sector.center, axial.access(point)))
				) as Triplet<Axial>,
			}))
			.filter(this.filterTriangles(sector))
			.map((triangle) => ({
				...triangle,
				points: triangle.points.map((point) =>
					axialCoordIndex(point, geometryVertex)
				) as Triplet<number>,
			}))
			.toArray()
		const sectorElements = { triangles, geometryVertex }
		this.vertexMatch.set(sector, sectorElements)
		return sectorElements
	}
	getTriangle(sector: Sector<Tile>, index: number): Triplet<Axial> {
		const cached = this.vertexMatch.get(sector)
		assert(cached, 'Must call getSectorElements first (render before hit-test)')
		return cached.triangles[index].points.map((p) => cached.geometryVertex[p]) as Triplet<Axial>
	}
	abstract filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle<Axial>) => boolean
}
