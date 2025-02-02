import type { BufferGeometry, Intersection, Material, Object3D, Object3DEventMap } from 'three'
import type { MouseHandle } from '~/mouse'
import type { Triplet } from '~/types'
import { type Axial, axial } from '~/utils'
import type { Sector } from '../sector'
import { ContinuousLandscape, type LandscapeTriangle } from './landscape'
import type { ContentTile } from './resourceful'

export abstract class ContinuousPartialLandscape<
	Tile extends ContentTile,
	MouseEvents extends {} = {},
> extends ContinuousLandscape<Tile, MouseEvents> {
	private vertexMatch?: Int32Array
	createGeometry(sector: Sector<Tile>, triangles: LandscapeTriangle[]): BufferGeometry | undefined {
		const filteredTriangles = triangles.filter(this.filterTriangles(sector))
		if (!filteredTriangles.length) return
		let index = 0
		this.vertexMatch = new Int32Array(filteredTriangles.length * 3)
		for (const triangle of filteredTriangles)
			for (const point of triangle.points) this.vertexMatch[index++] = point.key
		return this.createPartialGeometry(sector, filteredTriangles)
	}
	rawMouseHandler(
		sector: Sector<Tile>,
		intersection: Intersection<Object3D<Object3DEventMap>>
	): MouseHandle | undefined {
		const bary = intersection.barycoord!.toArray()
		const vm = this.vertexMatch!
		const v = intersection.face!.a
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
