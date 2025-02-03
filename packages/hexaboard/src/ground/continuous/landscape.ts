import {
	type BufferGeometry,
	type Intersection,
	type Material,
	Mesh,
	type Object3D,
	type Object3DEventMap,
	type RGB,
} from 'three'
import type { Game } from '~/game'
import type { MouseHandle } from '~/input'
import type { Triplet } from '~/types'
import { assert, type Axial, type AxialCoord, Eventful, axial } from '~/utils'
import type { RenderedEvents, TileBase } from '../land'
import type { Landscape } from '../landscaper'
import type { Sector } from '../sector'

interface ColorTile extends TileBase {
	color: RGB
}
export interface LandscapeTriangle<A extends AxialCoord = Axial> {
	side: 0 | 1
	points: Triplet<A>
}

const geometryCache = new Map<
	number,
	{
		triangles: LandscapeTriangle<AxialCoord>[]
		geometryVertex: AxialCoord[]
	}
>()

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

export abstract class ContinuousLandscape<Tile extends TileBase, MouseEvents extends {} = {}>
	extends Eventful<RenderedEvents<Tile> & MouseEvents>
	implements Landscape<Tile>
{
	private readonly triangles: LandscapeTriangle<AxialCoord>[]
	private readonly geometryVertex: AxialCoord[]

	constructor(sectorRadius: number) {
		super()
		if (geometryCache.has(sectorRadius)) {
			const { triangles, geometryVertex } = geometryCache.get(sectorRadius)!
			this.triangles = triangles
			this.geometryVertex = geometryVertex
		} else {
			this.triangles = []
			this.geometryVertex = []
			for (const triangle of sectorTriangles(sectorRadius - 1)) {
				this.triangles.push(triangle)
				this.geometryVertex.push(...triangle.points)
			}
			geometryCache.set(sectorRadius, {
				triangles: this.triangles,
				geometryVertex: this.geometryVertex,
			})
		}
	}
	createSector3D(sector: Sector<Tile>): Object3D {
		const geometry = this.createGeometry(sector, centeredTriangles(this.triangles, sector.center))
		const mesh = new Mesh(geometry, this.material)

		if (this.mouseHandler)
			mesh.userData = {
				mouseHandler: (
					game: Game<Tile>,
					target: any,
					intersection: Intersection<Object3D<Object3DEventMap>>
				) => this.rawMouseHandler(sector, intersection),
				mouseTarget: this,
			}
		return mesh
	}
	rawMouseHandler(sector: Sector<Tile>, intersection: Intersection<Object3D<Object3DEventMap>>) {
		const baryArr = intersection.barycoord!.toArray()
		const v = intersection.face!.a
		assert(v < this.geometryVertex!.length, 'Invalid vertex index')
		const vm = this.geometryVertex!
		const keys = [vm[v], vm[v + 1], vm[v + 2]]
		const points = keys.map((k) => axial.coordAccess(axial.linear(sector.center, k)))
		return this.mouseHandler!(sector, points as Triplet<Axial>, baryArr)
	}
	mouseHandler?(
		sector: Sector<Tile>,
		points: Triplet<Axial>,
		bary: Triplet<number>
	): MouseHandle | undefined
	protected abstract createGeometry(
		sector: Sector<Tile>,
		triangles: LandscapeTriangle[]
	): BufferGeometry | undefined
	protected abstract material: Material
}
