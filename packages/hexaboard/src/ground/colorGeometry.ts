import { BufferAttribute, BufferGeometry, type Material, MeshBasicMaterial, type RGB } from 'three'
import { assert } from '~/utils/debug'
import type { TileNature } from './land'
import type { RenderedTile } from './landscape'
import type { GeometryBuilder, TileRenderBase, TriangleBase } from './landscape'

interface ColorTileRender extends TileRenderBase {
	color: RGB
}

/**
 * For testing purpose
 */
export class ColorGeometry implements GeometryBuilder<TriangleBase, ColorTileRender> {
	public readonly material: Material
	public readonly mouseReactive = true
	constructor() {
		this.material = new MeshBasicMaterial({
			vertexColors: true,
			wireframe: true,
		})
	}
	createGeometry(
		tiles: Map<string, RenderedTile<TriangleBase, ColorTileRender>>,
		triangles: TriangleBase[]
	): BufferGeometry {
		const positions = new Float32Array(triangles.length * 9)
		const colors = new Float32Array(triangles.length * 9)
		let index = 0
		for (const triangle of triangles) {
			const { tilesKey } = triangle
			for (const tileKey of tilesKey) {
				const tile = tiles.get(tileKey)
				assert(tile?.nature, 'Rendered point has a nature')
				const position = tile.nature.position
				const color = tile.rendered!.color
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
	tileRender(render: TileRenderBase, key: string, nature: TileNature): ColorTileRender {
		const h01 = Math.min(1, Math.max(0, nature.position.z / 150))
		return {
			...render,
			color: {
				r: 0,
				g: h01,
				b: 1 - h01,
			},
		}
	}
}
