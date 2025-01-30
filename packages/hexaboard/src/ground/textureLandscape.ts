import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type Material,
	Mesh,
	type Object3D,
	ShaderMaterial,
	type Texture,
	UniformsLib,
	UniformsUtils,
} from 'three'
import type { Triplet } from '~/types'
import { type AxialKey, LCG, axial, numbers } from '~/utils'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { Sector } from './sector'
import type { TerrainBase, TerrainDefinition, TerrainKey, TerrainTile } from './terrain'

interface TexturePosition {
	alpha: number
	inTextureRadius: number
	center: { u: number; v: number }
}
export interface TextureTerrain extends TerrainBase {
	texture: Texture
	// Textures are images virtually of size 1x1 - this is the size of the part of the picture taken by tiles
	inTextureRadius: number
}

export interface RoadBase {
	width: number
}

const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}

// TODO: Now, side is 0 or 1, optimize ?
function textureUVs(
	{ alpha, inTextureRadius, center: { u, v } }: TexturePosition,
	side: number,
	rot: number
) {
	const scAlpha = {
		cos: inTextureRadius * Math.cos(alpha),
		sin: inTextureRadius * Math.sin(alpha),
	}
	const rs = (rot + side) % 6
	const rs1 = (rs + 1) % 6

	// use `cos(a+b)=cos(a)*cos(b)-sin(a)*sin(b)` & `sin(a+b)=sin(a)*cos(b)+cos(a)*sin(b)`
	const bp1u = u + scAlpha.cos * scSummits[rs1].cos - scAlpha.sin * scSummits[rs1].sin
	const bp1v = v + scAlpha.cos * scSummits[rs1].sin + scAlpha.sin * scSummits[rs1].cos
	const bp2u = u + scAlpha.cos * scSummits[rs].cos - scAlpha.sin * scSummits[rs].sin
	const bp2v = v + scAlpha.cos * scSummits[rs].sin + scAlpha.sin * scSummits[rs].cos
	switch (rot) {
		case 0:
			return [u, v, bp1u, bp1v, bp2u, bp2v]
		case 2:
			return [bp1u, bp1v, bp2u, bp2v, u, v]
		case 4:
			return [bp2u, bp2v, u, v, bp1u, bp1v]
		default:
			throw new Error('Invalid rotation value')
	}
}

export class TextureLandscape implements Landscape<TerrainTile> {
	public readonly material: Material
	public readonly mouseReactive = true
	private readonly textures: Texture[]
	private texturesIndex: Record<TerrainKey, number>

	constructor(
		private readonly terrainDefinition: TerrainDefinition<TextureTerrain>,
		private readonly seed: number
	) {
		this.textures = Array.from(
			new Set(Object.values(terrainDefinition.types).map((t) => t.texture))
		)
		this.material = threeTexturedMaterial(this.textures)

		// Index of all the textures by terrain type name
		this.texturesIndex = Object.fromEntries(
			Object.entries(this.terrainDefinition.types).map(([k, v]) => [
				k,
				this.textures.indexOf(v.texture),
			])
		)
	}
	createMesh(sector: Sector<TerrainTile>, triangles: LandscapeTriangle[]): Object3D {
		const textureUvCache = new Map(
			sector.tiles.entries().map(([i, tile]) => {
				const coord = axial.coord(i)
				const gen = LCG(this.seed, 'terrainTextures', coord.q, coord.r)
				return [
					i,
					{
						alpha: gen(Math.PI * 2),
						inTextureRadius: this.terrainDefinition.types[tile.terrain].inTextureRadius,
						center: {
							u: gen(),
							v: gen(),
						},
					},
				]
			})
		)
		const neighborsMap = new Map<AxialKey, Triplet<number>[]>()
		// 1- compute each vertex normal
		for (const [i, tile] of sector.tiles.entries()) {
			neighborsMap.set(
				i,
				axial.neighbors(i).map((n) => {
					const { x, y, z } = sector.land.tile(n).position
					return [x, y, z]
				})
			)
		}

		const positions = new Float32Array(triangles.length * 3 * 3)
		const textureIdx = new Uint8Array(triangles.length * 3 * 3)
		const barycentric = new Float32Array(triangles.length * 3 * 3)
		const n1 = new Float32Array(triangles.length * 3 * 3)
		const n2 = new Float32Array(triangles.length * 3 * 3)
		const n3 = new Float32Array(triangles.length * 3 * 3)
		const n4 = new Float32Array(triangles.length * 3 * 3)
		const n5 = new Float32Array(triangles.length * 3 * 3)
		const n6 = new Float32Array(triangles.length * 3 * 3)

		const uvA = new Float32Array(triangles.length * 3 * 2)
		const uvB = new Float32Array(triangles.length * 3 * 2)
		const uvC = new Float32Array(triangles.length * 3 * 2)
		barycentric.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0)
		// Exponentially copy the constant points
		for (let multiplier = 1; multiplier < triangles.length; multiplier <<= 1)
			((m) => barycentric.copyWithin(m, 0, m))(multiplier * 9)

		let index = 0
		for (const triangle of triangles) {
			const { coords, side } = triangle
			const [A, B, C] = coords.map((coord) => textureUvCache.get(axial.key(coord))!)
			uvA.set(textureUVs(A, side, 0), index * 2)
			uvB.set(textureUVs(B, side, 4), index * 2)
			uvC.set(textureUVs(C, side, 2), index * 2)
			//textureIdx.set(triangle.textureIdx, index * 3)
			const textureIndexes = coords.map(
				(coord) => this.texturesIndex[sector.tiles.get(axial.key(coord))!.terrain]
			)
			for (const tileCoord of coords) {
				const tileKey = axial.key(tileCoord)
				const tile = sector.tiles.get(tileKey)!
				const position = tile.position

				positions.set([position.x, position.y, position.z], index * 3)
				textureIdx.set(textureIndexes, index * 3)
				const neighbors = neighborsMap.get(tileKey)!

				n1.set(neighbors[5], index * 3)
				n2.set(neighbors[4], index * 3)
				n3.set(neighbors[3], index * 3)
				n4.set(neighbors[2], index * 3)
				n5.set(neighbors[1], index * 3)
				n6.set(neighbors[0], index * 3)

				index++
			}
		}
		const geometry = new BufferGeometry()
		// global
		geometry.setAttribute('barycentric', new BufferAttribute(barycentric, 3))
		// per triangle
		geometry.setAttribute('uvA', new BufferAttribute(uvA, 2))
		geometry.setAttribute('uvB', new BufferAttribute(uvB, 2))
		geometry.setAttribute('uvC', new BufferAttribute(uvC, 2))
		geometry.setAttribute('textureIdx', new BufferAttribute(textureIdx, 3))
		// per point
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		geometry.setAttribute('n1', new BufferAttribute(n1, 3))
		geometry.setAttribute('n2', new BufferAttribute(n2, 3))
		geometry.setAttribute('n3', new BufferAttribute(n3, 3))
		geometry.setAttribute('n4', new BufferAttribute(n4, 3))
		geometry.setAttribute('n5', new BufferAttribute(n5, 3))
		geometry.setAttribute('n6', new BufferAttribute(n6, 3))
		return new Mesh(geometry, this.material)
	}
}

// TODO: `textures` should have to be passed as `texture1, texture2, ...`
// TODO: Lighting - normals are calculated already, we just don't feel them
function threeTexturedMaterial(textures: Texture[]) {
	const nbrTextures = textures.length
	const texturesCase = numbers(nbrTextures).map(
		(n) => `if (i == ${n}) return texture2D(textures[${n}], vUv);`
	)
	return new ShaderMaterial({
		lights: true,
		uniforms: UniformsUtils.merge([
			UniformsLib.lights, // Include light uniforms
			{
				textures: { value: textures },
				roadColor: { value: new Color(0xff0000) },
				roadWidth: { value: 0.07 },
				roadBlend: { value: 0.05 },
			},
		]),
		vertexShader: `
varying vec2 vUv[3];
varying vec3 bary;
attribute vec3 barycentric;
attribute vec2 uvA;
attribute vec2 uvB;
attribute vec2 uvC;
attribute vec3 textureIdx;
varying vec3 vTextureIdx;
attribute vec3 n1;
attribute vec3 n2;
attribute vec3 n3;
attribute vec3 n4;
attribute vec3 n5;
attribute vec3 n6;
//varying vec3 vNormal;
//varying vec3 vViewPosition;
varying vec3 vPosition;

vec3 computeHexNormal(vec3 center, vec3 n1, vec3 n2, vec3 n3, vec3 n4, vec3 n5, vec3 n6) {
    vec3 computed = vec3(0.0);

    computed += cross(n1 - center, n2 - center);
    computed += cross(n2 - center, n3 - center);
    computed += cross(n3 - center, n4 - center);
    computed += cross(n4 - center, n5 - center);
    computed += cross(n5 - center, n6 - center);
    computed += cross(n6 - center, n1 - center);

    return computed;
}

void main() {
	vUv[0] = uvA;
	vUv[1] = uvB;
	vUv[2] = uvC;
	bary = barycentric;
	vTextureIdx = textureIdx;

	//vNormal = normalize(normalMatrix * computeHexNormal(position, n1, n2, n3, n4, n5, n6));
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    //vViewPosition = -mvPosition.xyz; // View space position relative to the camera
	vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
	gl_Position = projectionMatrix * mvPosition;
}
				`,
		fragmentShader: `
uniform sampler2D textures[${nbrTextures}];

varying vec2 vUv[3];
varying vec3 bary;
varying vec3 vTextureIdx;
//varying vec3 vNormal;
//varying vec3 vViewPosition;
varying vec3 vPosition;

float influence(float coord) {
	return coord * coord; // Quadratic function scaled to reach 1 at coord = 0.5
}

vec4 tColor(sampler2D textures[${nbrTextures}], int i, vec2 vUv) {
	${texturesCase.join('\n')}
	return vec4(1.0, 0.0, 0.0, 1.0);
}

uniform vec3 roadColor;
uniform float roadWidth;
uniform float roadBlend;

// Function to check how close we are to an edge
float edgeFactor(vec3 bary, vec3 pos) {
    float d0 = bary.x;
    float d1 = bary.y;
    float d2 = bary.z;

    // Take the minimum distance to the closest edge
    float edgeDist = min(d0, min(d1, d2));

    // If the fragment is within road width, mark it as road
    return smoothstep(roadWidth, roadWidth + roadBlend, edgeDist);
}

void main() {
	vec4 color1 = tColor(textures, int(round(vTextureIdx.x)), vUv[0]);
	vec4 color2 = tColor(textures, int(round(vTextureIdx.y)), vUv[1]);
	vec4 color3 = tColor(textures, int(round(vTextureIdx.z)), vUv[2]);
	
	// Normalize weights to ensure they sum to 1
	vec3 weights = vec3(influence(bary.x), influence(bary.y), influence(bary.z));
	float sum = dot(weights, vec3(1.0)); // Sum of weights
	weights /= sum; // Normalize weights

	// Apply the weights to the colors
	vec4 terrainColor = vec4(color1.rgb * weights.x + color2.rgb * weights.y + color3.rgb * weights.z, 1.0);

	float roadMask = edgeFactor(bary, vPosition);

	vec3 finalColor = mix(roadColor, terrainColor.xyz, roadMask);
	gl_FragColor = vec4(finalColor, 1.0);


}
				`,
	})
}
