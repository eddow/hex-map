import { Object3D } from 'three'
import type { HandledMouseEvents, MouseHandle, MouseHandler } from '~/mouse'
import type { Triplet } from '~/types'
import { type AxialKey, Eventful } from '~/utils'
import type { RenderedEvents } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { ContentTile } from './resourceful'
import type { Sector } from './sector'

export abstract class PartialLandscape<
		Tile extends ContentTile,
		Handle extends MouseHandle = MouseHandle,
	>
	extends Eventful<HandledMouseEvents<Handle> & RenderedEvents<Tile>>
	implements Landscape<Tile>
{
	private vertexMatch?: Int32Array
	readonly mouseReactive = false
	protected axialKeys(v: number): Triplet<AxialKey> {
		const vm = this.vertexMatch!
		return [vm[v], vm[v + 1], vm[v + 2]]
	}
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const filteredTriangles = triangles.filter(this.filterTriangles(sector))
		if (!filteredTriangles.length) return new Object3D()
		let index = 0
		this.vertexMatch = new Int32Array(filteredTriangles.length * 3)
		for (const triangle of filteredTriangles)
			for (const point of triangle.points) this.vertexMatch[index++] = point.key
		const o3d = this.createPartialMesh(sector, filteredTriangles)
		if (this.mouseHandler)
			o3d.userData = { mouseHandler: this.mouseHandler(sector), mouseTarget: this }
		return o3d
	}
	mouseHandler?(sector: Sector<Tile>): MouseHandler
	abstract filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean
	abstract createPartialMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
}
