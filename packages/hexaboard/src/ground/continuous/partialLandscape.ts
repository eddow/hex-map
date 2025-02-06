import type { BufferGeometry, Intersection, Material, Object3D, Object3DEventMap } from 'three'
import type { MouseHandle } from '~/input'
import type { Triplet } from '~/types'
import { assert, type Axial, axial } from '~/utils'
import type { Sector } from '../sector'
import { ContinuousLandscape, type LandscapeTriangle } from './landscape'
import type { ContentTile } from './resourceful'

export abstract class ContinuousPartialLandscape<
	Tile extends ContentTile,
> extends ContinuousLandscape<Tile> {
	private vertexMatch = new WeakMap<Sector<Tile>, Int32Array>()
	createGeometry(sector: Sector<Tile>, triangles: LandscapeTriangle[]): BufferGeometry | undefined {
		const filteredTriangles = triangles.filter(this.filterTriangles(sector))
		if (!filteredTriangles.length) return
		let index = 0
		const vertexMatch = new Int32Array(filteredTriangles.length * 3)
		this.vertexMatch.set(sector, vertexMatch)
		for (const triangle of filteredTriangles)
			for (const point of triangle.points) vertexMatch[index++] = point.key
		return this.createPartialGeometry(sector, filteredTriangles)
	}
	rawMouseHandler(
		sector: Sector<Tile>,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): MouseHandle | undefined {
		const bary = intersection.barycoord!.toArray()
		const vm = this.vertexMatch.get(sector)!
		const v = intersection.face!.a
		assert(v + 3 <= vm.length, 'Vertex in boundary')
		const keys = [vm[v], vm[v + 1], vm[v + 2]]
		const points = keys.map((k) => axial.keyAccess(k))
		return this.mouseHandler!(sector, points as Triplet<Axial>, bary)
	}
	abstract filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean
	abstract createPartialGeometry(
		sector: Sector<Tile>,
		triangles: LandscapeTriangle[]
	): BufferGeometry
	protected abstract material: Material
}
