import { BufferAttribute, Group, type Mesh, ShaderMaterial, Vector3 } from 'three'
import { type Handelable, generateResources, terrainContentRadius } from '~/game/handelable'
import {
	type TerrainTexture,
	type TerrainType,
	type TerrainsDefinition,
	genTexture,
	textureUVs,
} from '~/game/terrain'
import { SharedShaderMaterial } from '~/three/sharedShaderMaterial'
import LCG, { type RandGenerator } from '~/utils/misc'
import HexSector from './sector'
import {
	type Axial,
	axialAt,
	axialIndex,
	axialPolynomial,
	cartesian,
	hexSides,
	hexTiles,
	posInTile,
} from './utils'

/* TODO:
import fsTexture3 from './shaders/texture3.fs'
import vsTexture3 from './shaders/texture3.vs'
*/

interface BasePoint {
	z: number
	group?: Group
}

export default abstract class HexPow2Gen<Point extends BasePoint = BasePoint> extends HexSector {
	readonly points: Point[] = []
	constructor(
		position: Vector3,
		tileSize: number,
		public readonly scale: number,
		public readonly terrains: TerrainsDefinition
	) {
		super(position, tileSize, 1 + (1 << scale))
	}
	generate(gen: RandGenerator) {
		const corners = hexSides.map((side) => axialPolynomial([1 << this.scale, side]))
		this.initCorners(corners.map(axialIndex), gen)
		for (let c = 0; c < 6; c++)
			this.divTriangle(this.scale, corners[c], corners[(c + 1) % 6], { q: 0, r: 0 })
		super.generate(gen)
	}
	/**
	 * Initialize the points from a virgin sector (generate random resources and artifacts)
	 */
	virgin() {
		for (let t = 0; t < this.nbrTiles; t++) this.populatePoint(this.points[t], axialAt(t), t)
	}
	divTriangle(scale: number, ...triangle: Axial[]) {
		if (scale === 0) return

		const points = triangle.map(axialIndex)
		const mids = triangle.map((a, i) => axialPolynomial([0.5, a], [0.5, triangle[(i + 1) % 3]]))
		const midPoints = mids.map(axialIndex)
		for (let i = 0; i < 3; i++)
			if (!this.points[midPoints[i]])
				this.points[midPoints[i]] = this.insidePoint(
					this.points[points[i]],
					this.points[points[(i + 1) % 3]],
					scale
				)
		if (scale > 0) {
			this.divTriangle(scale - 1, ...mids)
			for (let i = 0; i < 3; i++)
				this.divTriangle(scale - 1, triangle[i], mids[i], mids[(i + 2) % 3])
		}
	}
	/**
	 * Initiate the custom data of the center (index 0) and corners (given 6 indices) points
	 * @param corners Indices of the corners
	 */
	abstract initCorners(corners: number[], gen: RandGenerator): void
	abstract insidePoint(p1: Point, p2: Point, scale: number): Point
	abstract populatePoint(p: Point, position: Axial, hexIndex: number): void

	vPosition(ndx: number) {
		return new Vector3().copy({
			...cartesian(axialAt(ndx), this.tileSize),
			z: Math.max(this.points[ndx].z, 0),
		})
	}
}

export interface HeightPoint extends BasePoint {
	type: TerrainType
	seed: number
	content: (Handelable | undefined)[]
	texture: TerrainTexture
}

const terrainMaterial = new SharedShaderMaterial(
	new ShaderMaterial({
		uniforms: {
			textures: { value: [] },
		},
		vertexShader: `
varying vec2 vUv[3];
varying vec3 bary;
attribute vec3 barycentric;
attribute vec2 uvA;
attribute vec2 uvB;
attribute vec2 uvC;
void main() {
	vUv[0] = uvA;
	vUv[1] = uvB;
	vUv[2] = uvC;
	bary = barycentric;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
			`,
		fragmentShader: `
uniform sampler2D textures[3];
varying vec2 vUv[3];
varying vec3 bary;

float quadraticInfluence(float coord) {
    return 4.0 * coord * coord; // Quadratic function scaled to reach 1 at coord = 0.5
}

void main() {
	vec4 color1 = texture2D(textures[0], vUv[0]);
	vec4 color2 = texture2D(textures[1], vUv[1]);
	vec4 color3 = texture2D(textures[2], vUv[2]);
	
	// Compute weights
	float weight1 = quadraticInfluence(bary.x);
	float weight2 = quadraticInfluence(bary.y);
	float weight3 = quadraticInfluence(bary.z);

	// Normalize weights to ensure they sum to 1
	float sum = weight1 + weight2 + weight3;
	weight1 /= sum;
	weight2 /= sum;
	weight3 /= sum;

	// Apply the weights to the colors
	gl_FragColor = color1 * weight1 + color2 * weight2 + color3 * weight3;
}
			`,
	})
)

export abstract class HeightPowGen<
	Point extends HeightPoint = HeightPoint,
> extends HexPow2Gen<Point> {
	heightPoint(z: number, type: TerrainType, gen: RandGenerator, seed?: number): HeightPoint {
		const texture =
			z < 0
				? {
						texture: this.terrains.waterTexture,
						...genTexture(gen),
						alpha: 0,
					}
				: {
						texture: type.texture,
						...genTexture(gen),
					}
		return { z, type, seed: seed ?? gen(), content: [], texture }
	}
	insidePoint(p1: Point, p2: Point, scale: number): Point {
		const variance = (p1.type.variance + p2.type.variance) / 2
		const randScale = ((1 << scale) / this.radius) * this.terrains.terrainHeight * variance
		const seed = LCG(p1.seed, p2.seed)()
		const gen = LCG(seed)
		const z = (p1.z + p2.z) / 2 + gen(0.5, -0.5) * randScale
		const changeType = gen() < scale / this.scale
		const type = changeType ? this.terrains.terrainType(z) : [p1, p2][Math.floor(gen(2))].type
		return this.heightPoint(z, type, gen, seed) as Point
	}

	meshContent() {
		for (let hexIndex = 0; hexIndex < this.nbrTiles; hexIndex++) {
			const p = this.points[hexIndex]
			if (p.content.length) {
				if (!p.group) {
					p.group = new Group()
					p.group.position.copy(this.vPosition(hexIndex))
					this.group.add(p.group)
				}
				for (let i = 0; i < p.content.length; i++)
					if (p.content[i]) {
						const pos = this.cartesian(hexIndex, posInTile(i, terrainContentRadius))
						// Pos is null when no neighbor sector is present and the resource is out of rendering zone on the border
						if (pos) {
							const rsc = p.content[i]!
							if (!rsc.builtMesh) {
								const mesh = rsc.createMesh()
								mesh.position.copy(pos)
								p.group.add(mesh)
							}
						}
					}
			}
		}
	}
	populatePoint(p: HeightPoint, position: Axial, hexIndex: number): void {
		const gen = LCG(p.seed + 0.2)
		if (p.z > 0)
			p.content = Array.from(generateResources(gen, p.type, hexTiles(terrainContentRadius + 1)))
	}
	triangle(ndx: [number, number, number], side: number): Mesh {
		const points = ndx.map((n) => this.points[n])
		const geometry = super.triangleGeometry(ndx)
		// TODO: Make a vector
		geometry.setAttribute('uvA', textureUVs(points[0].texture, side, 0))
		geometry.setAttribute('uvB', textureUVs(points[1].texture, side, 4))
		geometry.setAttribute('uvC', textureUVs(points[2].texture, side, 2))
		//geometry.setAttribute('texturesIdx', new Int16BufferAttribute([0, 1, 2], 1))
		const barycentric = new Float32Array([
			1,
			0,
			0, // corresponds to vertex 1
			0,
			1,
			0, // corresponds to vertex 2
			0,
			0,
			1, // corresponds to vertex 3
		])
		geometry.setAttribute('barycentric', new BufferAttribute(barycentric, 3))
		return terrainMaterial.createMesh(geometry, { textures: points.map((p) => p.texture.texture) })
	}
}
