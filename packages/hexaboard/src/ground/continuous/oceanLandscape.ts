import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three'
import type { WalkTimeSpecification } from '../land'
import type { Sector } from '../sector'
import { ContinuousLandscape, type LandscapeTriangle } from './landscape'
import type { RiverTile } from './rivers'

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

// TODO: become a partialLandscape
export class OceanLandscape<Tile extends RiverTile = RiverTile> extends ContinuousLandscape<Tile> {
	protected readonly material = oceanMaterial
	constructor(
		sectorRadius: number,
		private readonly seaLevel: number
	) {
		super(sectorRadius)
	}
	createGeometry(sector: Sector<Tile>, triangles: LandscapeTriangle[]) {
		const positions: number[] = []
		const opacities: number[] = []
		const indices: number[] = []
		const tileIndices = new Map<Tile, number>()
		const seaLevel = this.seaLevel
		for (const triangle of triangles) {
			const triangleTiles = triangle.points.map((coord) => sector.tiles.get(coord)!)
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
		return geometry
	}
	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number | undefined {
		if (movement.on.position.z < this.seaLevel) return Number.NaN
	}
}
