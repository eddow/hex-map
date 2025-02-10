import { BufferAttribute, BufferGeometry, type Material, MeshBasicMaterial, type RGB } from 'three'
import type { AxialCoord } from '~/utils'
import type { TileBase } from '../land'
import type { Sector } from '../sector'
import { CompleteLandscape } from './completeLandscape'
import { centeredTriangles, type LandscapeTriangle } from './landscape'

interface ColorTile extends TileBase {
	color: RGB
}

export class ContinuousColorLandscape<
	Tile extends ColorTile = ColorTile,
> extends CompleteLandscape<Tile> {
	protected readonly material: Material
	constructor(sectorRadius: number) {
		super(sectorRadius)
		this.material = new MeshBasicMaterial({
			vertexColors: true,
			wireframe: true,
		})
	}
	async createGeometry(sector: Sector<Tile>, genericTriangles: LandscapeTriangle<AxialCoord>[]) {
		const triangles = centeredTriangles(genericTriangles, sector.center)
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
		return geometry
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
