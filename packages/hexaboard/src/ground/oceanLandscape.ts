import { BufferGeometry, Float32BufferAttribute, Mesh, type Object3D, ShaderMaterial } from 'three'
import { axial } from '~/utils'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { RiverTile } from './rivers'
import type { Sector } from './sector'

/**
 * For testing purpose
 */
export class OceanLandscape implements Landscape<RiverTile> {
	public readonly mouseReactive = false
	constructor(private readonly seaLevel: number) {}
	createMesh(sector: Sector<RiverTile>, triangles: LandscapeTriangle[]): Object3D {
		const positions: number[] = []
		const opacities: number[] = []
		const indices: number[] = []
		const tileIndices = new Map<RiverTile, number>()
		const seaLevel = this.seaLevel
		for (const triangle of triangles) {
			const triangleTiles = triangle.points.map((coord) => sector.tiles.get(axial.key(coord))!)
			if (
				!triangleTiles.some((tile) => tile.position.z < seaLevel) ||
				triangleTiles.some((tile) => tile.riverHeight !== undefined)
			)
				continue
			for (const tile of triangleTiles) {
				let tileVertex = tileIndices.get(tile)
				if (tileVertex === undefined) {
					tileVertex = tileIndices.size
					tileIndices.set(tile, tileVertex)

					const { x, y, z } = tile.position
					const opacity = (seaLevel - z) / (seaLevel * 2)
					positions.push(x, y, seaLevel)
					opacities.push(opacity)
				}
				indices.push(tileVertex)
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('opacity', new Float32BufferAttribute(opacities, 1))
		geometry.setIndex(indices)
		return new Mesh(geometry, oceanMaterial)
	}
}

const oceanMaterial = new ShaderMaterial({
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
