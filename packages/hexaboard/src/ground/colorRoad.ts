import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type Material,
	Mesh,
	type Object3D,
	type RGB,
	ShaderMaterial,
	type Texture,
	UniformsLib,
	UniformsUtils,
} from 'three'
import { assert, axial } from '~/utils'
import type { LandscapeTriangle } from './landscaper'
import { type RoadBase, RoadGrid, type RoadKey, type RoadTile } from './road'
import type { Sector } from './sector'

export interface TextureRoad extends RoadBase {
	texture: Texture
	side: 0 | 1 // Whether we go from 0.5-0 or 0.5-1
	x: number // Where in the (linear) texture
}

export interface ColorRoad extends RoadBase {
	color: RGB
	blend: number
}

export class ColorRoadGrid<Tile extends RoadTile> extends RoadGrid<Tile> {
	public readonly material: Material

	constructor(private readonly roadDefinition: Record<RoadKey, ColorRoad>) {
		super()
		this.material = roadColorMaterial()
	}
	createPartialMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const positions = new Float32Array(triangles.length * 3 * 3)
		const outRoadWidths = new Float32Array(triangles.length * 3 * 3)
		const outRoadBlends = new Float32Array(triangles.length * 3 * 3)
		const inRoadWidths = new Float32Array(triangles.length * 3 * 3)
		const inRoadBlends = new Float32Array(triangles.length * 3 * 3)
		const barycentric = new Float32Array(triangles.length * 3 * 3)
		// Bary-centers allow the shaders to know the distance of a fragment toward a vertex
		barycentric.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0)
		// Exponentially copy the constant points
		for (let multiplier = 1; multiplier < triangles.length; multiplier <<= 1)
			((m) => barycentric.copyWithin(m, 0, m))(multiplier * 9)

		let index = 0
		for (const triangle of triangles) {
			// Calculate the 3 terrain textures parameters
			const { points, side } = triangle
			const outRoadWidth = []
			const outRoadBlend = []
			const inRoadWidth = []
			const inRoadBlend = []
			//if (points[2].key === 1) debugger
			let o2 = 1
			let o1 = 0
			for (let p = 0; p < 3; p++) {
				// Calculate the road [side] opposite to `p`
				o1 = o2
				o2 = (o2 + 1) % 3
				const tile1 = sector.tiles.get(points[o1].key)!
				const neighborIndex = axial.neighborIndex(points[o2], points[o1])
				assert(neighborIndex !== undefined, 'O-s are neighbors')
				const roadType = tile1.roads[neighborIndex]
				if (roadType) {
					const road = this.roadDefinition[roadType]
					outRoadWidth[p] = road.width
					outRoadBlend[p] = road.blend
				} else {
					outRoadWidth[p] = 0
					outRoadBlend[p] = 0
				}
				// TODO: Oder by type level (mud road < highway < railroad) and take the highest level
				// Calculate the road [point] `o1` is in
				const inRoadType = tile1.roads.find((roadType) => roadType !== undefined)
				if (inRoadType) {
					const road = this.roadDefinition[inRoadType]
					inRoadWidth[o1] = road.width
					inRoadBlend[o1] = road.blend
				} else {
					inRoadWidth[o1] = 0
					inRoadBlend[o1] = 0
				}
			}
			for (const point of points) {
				const tile = sector.tiles.get(point.key)!
				const position = tile.position

				// Per vertex
				positions.set([position.x, position.y, position.z], index * 3)

				outRoadWidths.set(outRoadWidth, index * 3)
				outRoadBlends.set(outRoadBlend, index * 3)
				inRoadWidths.set(inRoadWidth, index * 3)
				inRoadBlends.set(inRoadBlend, index * 3)

				index++
			}
		}
		const geometry = new BufferGeometry()
		// global
		geometry.setAttribute('barycentric', new BufferAttribute(barycentric, 3))
		// per triangle
		geometry.setAttribute('outRoadWidths', new BufferAttribute(outRoadWidths, 3))
		geometry.setAttribute('outRoadBlends', new BufferAttribute(outRoadBlends, 3))
		geometry.setAttribute('inRoadWidths', new BufferAttribute(inRoadWidths, 3))
		geometry.setAttribute('inRoadBlends', new BufferAttribute(inRoadBlends, 3))
		// per point
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		return new Mesh(geometry, this.material)
	}
}

// TODO: Lighting - calculate normals (in RoadGrid?) and render it
function roadColorMaterial() {
	return new ShaderMaterial({
		lights: true,
		transparent: true,
		uniforms: UniformsUtils.merge([
			UniformsLib.lights, // Include light uniforms
			{
				roadColor: { value: new Color(0xff0000) },
			},
		]),
		vertexShader: `
attribute vec3 barycentric;
varying vec3 bary;
varying vec3 vPosition;

attribute vec3 outRoadWidths;
attribute vec3 outRoadBlends;
attribute vec3 inRoadWidths;
attribute vec3 inRoadBlends;
varying vec3 vOutRoadWidth;
varying vec3 vOutRoadBlend;
varying vec3 vInRoadWidth;
varying vec3 vInRoadBlend;


void main() {
	bary = barycentric;

	vOutRoadWidth = outRoadWidths;
	vOutRoadBlend = outRoadBlends;
	vInRoadWidth = inRoadWidths;
	vInRoadBlend = inRoadBlends;

	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
				`,
		fragmentShader: `
varying vec3 bary;

uniform vec3 roadColor;
varying vec3 vOutRoadWidth;
varying vec3 vOutRoadBlend;
varying vec3 vInRoadWidth;
varying vec3 vInRoadBlend;

void main() {
	float road = 1.0;
	if(vOutRoadWidth.x > 0.0)
		road = min(road, smoothstep(vOutRoadWidth.x, vOutRoadWidth.x + vOutRoadBlend.x, bary.x));
	if(vOutRoadWidth.y > 0.0)
		road = min(road, smoothstep(vOutRoadWidth.y, vOutRoadWidth.y + vOutRoadBlend.y, bary.y));
	if(vOutRoadWidth.z > 0.0)
		road = min(road, smoothstep(vOutRoadWidth.z, vOutRoadWidth.z + vOutRoadBlend.z, bary.z));

	if(vInRoadWidth.x > 0.0)
		road = min(road, smoothstep(vInRoadWidth.x, vInRoadWidth.x + vInRoadBlend.x, 1.0-bary.x));
	if(vInRoadWidth.y > 0.0)
		road = min(road, smoothstep(vInRoadWidth.y, vInRoadWidth.y + vInRoadBlend.y, 1.0-bary.y));
	if(vInRoadWidth.z > 0.0)
		road = min(road, smoothstep(vInRoadWidth.z, vInRoadWidth.z + vInRoadBlend.z, 1.0-bary.z));
	
	if(road >= 1.0) discard;
	gl_FragColor = vec4(roadColor, 1.0-road);

}
				`,
	})
}
