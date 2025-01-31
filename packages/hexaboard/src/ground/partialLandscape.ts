import { Object3D } from 'three'
import { Eventful } from '~/utils'
import type { RenderedEvent } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { ContentTile } from './resourceful'
import type { RoadBase } from './road'
import type { Sector } from './sector'

export abstract class PartialLandscape<Tile extends ContentTile, Road extends RoadBase>
	extends Eventful<RenderedEvent<Tile>>
	implements Landscape<Tile>
{
	mouseReactive = false // TODO - mouse reactive roads
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const filteredTriangles = triangles.filter(this.filterTriangles(sector))
		if (!filteredTriangles.length) return new Object3D()

		const mesh = this.createPartialMesh(sector, triangles)
		return mesh
	}
	abstract filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean
	abstract createPartialMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D
}
