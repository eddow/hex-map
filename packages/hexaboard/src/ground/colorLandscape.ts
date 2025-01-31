import {
	BufferAttribute,
	BufferGeometry,
	type Material,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	type RGB,
} from 'three'
import { type AxialCoord, Eventful } from '~/utils'
import type { RenderedEvent, TileBase } from './land'
import type { LandscapeTriangle } from './landscaper'
import type { Landscape } from './landscaper'
import type { Sector } from './sector'

interface ColorTile extends TileBase {
	color: RGB
}

/**
 * For testing purpose
 */
export class ColorLandscape<Tile extends ColorTile = ColorTile>
	extends Eventful<RenderedEvent<Tile>>
	implements Landscape<Tile>
{
	private readonly material: Material
	public readonly mouseReactive = true
	constructor() {
		super()
		this.material = new MeshBasicMaterial({
			vertexColors: true,
			wireframe: true,
		})
	}
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const positions = new Float32Array(triangles.length * 9)
		const colors = new Float32Array(triangles.length * 9)
		let index = 0
		for (const triangle of triangles) {
			for (const coord of triangle.points) {
				const tile = sector.tiles.get(coord)!
				const position = tile.position
				const color = tile.color
				positions.set([position.x, position.y, position.z], index * 3)
				colors.set([color.r, color.g, color.b], index * 3)
				index++
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		geometry.setAttribute('color', new BufferAttribute(colors, 3))
		return new Mesh(geometry, this.material)
	}
	refineTile(tile: TileBase, coord: AxialCoord): Tile {
		const h01 = Math.min(1, Math.max(0, tile.position.z / 150))
		return {
			...tile,
			color: {
				r: 0,
				g: h01,
				b: 1 - h01,
			},
		} as Tile
	}
}
