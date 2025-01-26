import {
	BufferGeometry,
	Float32BufferAttribute,
	type Material,
	Mesh,
	type Object3D,
	ShaderMaterial,
} from 'three'
import type { Sector, TileBase } from './land'
import type { Landscape, Triangle } from './landscaper'
/**
 * For testing purpose
 */
export class OceanLandscape implements Landscape<TileBase> {
	public readonly material: Material
	public readonly mouseReactive = false
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
	if(alpha < 0.00) discard;
	gl_FragColor = vec4(color, clamp(shoreOpacity + alpha * (1.0-shoreOpacity), shoreOpacity, 1.0));
}
						`,
		})
	}
	render(tiles: TileBase[], triangles: Triangle[], sector: Sector<TileBase>): Object3D {
		const positions: number[] = []
		const opacities: number[] = []
		const seaLevel = this.seaLevel
		const index = 0
		for (const triangle of triangles) {
			const { indexes } = triangle
			const triangleTiles = indexes.map((tileIndex) => tiles[tileIndex])
			if (!triangleTiles.some((tile) => tile.position.z < seaLevel)) continue
			for (const tile of triangleTiles) {
				const position = tile.position
				const opacity = (seaLevel - position.z) / (seaLevel * 2)
				positions.push(position.x, position.y, seaLevel)
				opacities.push(opacity)
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('opacity', new Float32BufferAttribute(opacities, 1))
		return new Mesh(geometry, this.material)
	}
}
