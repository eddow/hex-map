import { BufferAttribute, BufferGeometry, type Material, MeshBasicMaterial } from 'three'
import { assert } from '~/utils/debug'
import type { RenderedTile } from './landscape'
import type { GeometryBuilder, RenderedTriangle, TileRenderBase } from './landscape'

export class ColorGeometry implements GeometryBuilder<TileRenderBase> {
	createGeometry(
		tiles: Map<string, RenderedTile<TileRenderBase>>,
		triangles: Set<RenderedTriangle>
	): BufferGeometry {
		const positions = new Float32Array(triangles.size * 9)
		const colors = new Float32Array(triangles.size * 9)
		let index = 0
		for (const triangle of triangles) {
			const { tilesKey } = triangle
			for (const tileKey of tilesKey) {
				const tile = tiles.get(tileKey)
				assert(tile?.nature, 'Rendered point has a nature')
				const position = tile.nature.position
				const color = tile.nature.color
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
	tileRender(tile: TileRenderBase): TileRenderBase {
		return tile
	}
	get material(): Material {
		return new MeshBasicMaterial({
			vertexColors: true,
			wireframe: true,
		})
	}
}
