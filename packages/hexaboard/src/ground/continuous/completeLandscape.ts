import type { Game } from '~/game'
import type { Triplet } from '~/types'
import { type Axial, type AxialCoord, axial } from '~/utils'
import type { TileBase } from '../land'
import { TileHandle } from '../landscaper'
import type { Sector } from '../sector'
import {
	ContinuousLandscape,
	type SectorElements,
	axialCoordIndex,
	sectorTriangles,
} from './landscape'

const geometryCache = new Map<number, SectorElements>()

export abstract class CompleteLandscape<Tile extends TileBase> extends ContinuousLandscape<Tile> {
	protected readonly elements: SectorElements

	constructor(protected readonly game: Game) {
		super(game)
		const {
			land: { sectorRadius },
		} = game
		if (!geometryCache.has(sectorRadius)) {
			const geometryVertex: AxialCoord[] = []
			const triangles = sectorTriangles(sectorRadius)
				.map((triangle) => ({
					...triangle,
					points: triangle.points.map((point) =>
						axialCoordIndex(point, geometryVertex)
					) as Triplet<number>,
				}))
				.toArray()
			geometryCache.set(sectorRadius, { triangles, geometryVertex })
		}
		this.elements = geometryCache.get(sectorRadius)!
	}
	async getSectorElements(sector: Sector<Tile>): Promise<SectorElements> {
		return {
			...this.elements,
			geometryVertex: this.elements.geometryVertex.map((point) =>
				axial.coordAccess(axial.linear(sector.center, axial.access(point)))
			),
		}
	}
	getTriangle(sector: Sector<Tile>, index: number): Triplet<Axial> {
		return this.elements.triangles[index].points.map((p) =>
			axial.coordAccess(axial.linear(sector.center, this.elements.geometryVertex[p]))
		) as Triplet<Axial>
	}
	mouseHandler?(
		sector: Sector<Tile>,
		points: Triplet<Axial>,
		bary: Triplet<number>
	): TileHandle<Tile> {
		return new TileHandle(this, sector, points[bary.indexOf(Math.max(...bary))])
	}
}
