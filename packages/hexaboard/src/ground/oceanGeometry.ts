import { BufferGeometry, Float32BufferAttribute, type Material, ShaderMaterial } from 'three'
import { assert } from '~/utils/debug'
import type { RenderedTile } from './landscape'
import type { GeometryBuilder, RenderedTriangle, TileRenderBase } from './landscape'
/**
 * For testing purpose
 */
export class OceanGeometry implements GeometryBuilder<TileRenderBase> {
	public readonly material: Material
	constructor(private readonly seaLevel: number) {
		this.material = new ShaderMaterial({
			transparent: true,
			uniforms: {
				color: { value: [0, 0.2, 1] },
				shoreOpacity: { value: 0.1 },
			},
			vertexShader: `
		attribute float opacity;
		varying float alpha;

		void main() {
			alpha = opacity;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
						`,
			fragmentShader: `
		uniform vec3 color;
		uniform float shoreOpacity;
		varying float alpha;
		
		void main() {
		
			// Apply the weights to the colors
			gl_FragColor = vec4(color, clamp(shoreOpacity + alpha * (1.0-shoreOpacity), shoreOpacity, 1.0));
		}
						`,
		})
	}
	tileRender(tile: TileRenderBase): TileRenderBase {
		return tile
	}
	createGeometry(
		tiles: Map<string, RenderedTile<TileRenderBase>>,
		triangles: RenderedTriangle[]
	): BufferGeometry {
		const positions: number[] = []
		const opacities: number[] = []
		const seaLevel = this.seaLevel
		const index = 0
		for (const triangle of triangles) {
			const { tilesKey } = triangle
			//if (tilesKey.includes('0,0')) debugger
			const triangleTiles = tilesKey.map((tileKey) => tiles.get(tileKey)!)
			if (!triangleTiles.some((tile) => tile.nature!.position.z < seaLevel)) continue
			for (const tile of triangleTiles) {
				assert(tile?.nature, 'Rendered point has a nature')
				const position = tile.nature.position
				const opacity = (seaLevel - position.z) / seaLevel
				positions.push(position.x, position.y, seaLevel)
				opacities.push(opacity)
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('opacity', new Float32BufferAttribute(opacities, 1))
		return geometry
	}
}
