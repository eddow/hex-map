import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type Material,
	ShaderMaterial,
	type Texture,
	UniformsLib,
	UniformsUtils,
} from 'three'
import type { Triplet } from '~/types'
import { type Axial, type AxialKey, AxialKeyMap, LCG, axial, numbers } from '~/utils'
import type { TerrainBase, TerrainKey, TerrainTile } from '../perlinTerrain'
import type { Sector } from '../sector'
import { CompleteLandscape } from './completeLandscape'
import type { LandscapeTriangle } from './landscape'

interface TexturePosition {
	alpha: number
	radius: number
	center: { u: number; v: number }
}
export interface TextureTerrain extends TerrainBase {
	texture: Texture
}
export interface SeamlessTextureTerrain extends TextureTerrain {
	// Textures are images virtually of size 1x1 - this is the size of the part of the picture taken by tiles
	inTextureRadius: number
}

const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}

// TODO: Now, side is 0 or 1, optimize ?
function textureUVs(
	{ alpha, radius: inTextureRadius, center: { u, v } }: TexturePosition,
	side: 0 | 1,
	rot: 0 | 2 | 4
) {
	const scAlpha = {
		cos: inTextureRadius * Math.cos(alpha),
		sin: inTextureRadius * Math.sin(alpha),
	}
	const rs = rot + side
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

/**
 * Ways to mix textures between adjacent hexagons
 * Defines a glsl function `bary2weights` who takes a "barycentric" vector and returns a vector of weights
 * - barycentric: a point in a pain triangle A B C, can be written as `x * A + y * B + z * C` where x + y + z = 1
 * - weights: a vector of 3 weights, summing to 1, giving which texture will be used for the computation of that fragment
 *
 * Note: weights are normalized to sum to 1 afterward, so `bary2weights` does not have to return a normalized vector
 */
export const weightMix = {
	/**
	 * Fade with a polynomial gradient between textures (the higher the degree, the shorter the transition)
	 * @param degree
	 * @returns
	 */
	polynomial(degree: number) {
		return `
float influence(float coord) {
	return pow(coord, ${degree.toFixed(2)});
}

vec3 bary2weights(vec3 bary) {
	return vec3(influence(bary.x), influence(bary.y), influence(bary.z));
}
		`
	},
	oneHotMax: `
vec3 bary2weights(vec3 v) {
    vec3 mask = step(max(v.x, max(v.y, v.z)), v);
    return mask / dot(mask, vec3(1.0)); // Ensures only one component is 1
}`,
}

export interface TileTextureStyle<Terrain extends TextureTerrain = TextureTerrain> {
	/**
	 * GLSL texture mixer for borders
	 */
	weightMix: string
	/**
	 * Choose which part of the texture is rendered around a point
	 * @param point
	 * @returns
	 */
	texturePosition(terrain: Terrain, point: Axial): TexturePosition
}

export const textureStyle = {
	seamless(degree: number, seed: number): TileTextureStyle<SeamlessTextureTerrain> {
		return {
			weightMix: weightMix.polynomial(degree),
			texturePosition(terrain, point) {
				const gen = LCG(seed, 'seamlessTextureStyle', point.q, point.r)
				return {
					alpha: gen(Math.PI * 2),
					radius: terrain.inTextureRadius,
					center: {
						u: gen(),
						v: gen(),
					},
				}
			},
		}
	},
	// TODO: `pick in may` - give a texture with many variations in a matrix-like picture and pick one
	unique: {
		weightMix: weightMix.oneHotMax,
		texturePosition() {
			return {
				alpha: 0,
				radius: 1,
				center: {
					u: 0.5,
					v: 0.5,
				},
			}
		},
	},
}

export class ContinuousTextureLandscape<
	Tile extends TerrainTile = TerrainTile,
	Terrain extends TextureTerrain = TextureTerrain,
> extends CompleteLandscape<Tile> {
	public readonly material: Material
	private readonly textures: Texture[]
	private texturesIndex: Record<TerrainKey, number>
	constructor(
		sectorRadius: number,
		private readonly terrainTypes: Record<TerrainKey, TextureTerrain>,
		private readonly textureStyle: TileTextureStyle<Terrain>
	) {
		super(sectorRadius)
		this.textures = Array.from(new Set(Object.values(terrainTypes).map((t) => t.texture)))
		this.material = threeTexturedMaterial(this.textures, textureStyle.weightMix)

		// Index of all the textures by terrain type name
		this.texturesIndex = Object.fromEntries(
			Object.entries(this.terrainTypes).map(([k, v]) => [k, this.textures.indexOf(v.texture)])
		)
	}
	createGeometry(sector: Sector<Tile>, triangles: LandscapeTriangle[]): BufferGeometry {
		// Gather the texture positions
		const { textureStyle, terrainTypes } = this
		const textureUvCache = new AxialKeyMap(
			(function* () {
				for (const [i, tile] of sector.tiles) {
					const coord = axial.keyAccess(i)
					yield [
						i,
						textureStyle.texturePosition(terrainTypes[tile.terrain] as Terrain, axial.keyAccess(i)),
					]
				}
			})()
		)
		const neighborsMap = new Map<AxialKey, Triplet<number>[]>()
		// Gather the neighbors in order to compute the hexagonal normal in the vertex shader
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
		/*const n1 = new Float32Array(triangles.length * 3 * 3)
		const n2 = new Float32Array(triangles.length * 3 * 3)
		const n3 = new Float32Array(triangles.length * 3 * 3)
		const n4 = new Float32Array(triangles.length * 3 * 3)
		const n5 = new Float32Array(triangles.length * 3 * 3)
		const n6 = new Float32Array(triangles.length * 3 * 3)*/

		const uvA = new Float32Array(triangles.length * 3 * 2)
		const uvB = new Float32Array(triangles.length * 3 * 2)
		const uvC = new Float32Array(triangles.length * 3 * 2)
		// Bary-centers allow the shaders to know the distance of a fragment toward a vertex
		barycentric.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0)
		// Exponentially copy the constant points
		for (let multiplier = 1; multiplier < triangles.length; multiplier <<= 1)
			((m) => barycentric.copyWithin(m, 0, m))(multiplier * 9)

		let index = 0
		for (const triangle of triangles) {
			// Calculate the 3 terrain textures parameters
			const { points, side } = triangle
			const [A, B, C] = points.map((point) => textureUvCache.get(point)!)
			uvA.set(textureUVs(A, side, 0), index * 2)
			uvB.set(textureUVs(B, side, 4), index * 2)
			uvC.set(textureUVs(C, side, 2), index * 2)
			const textureIndexes = points.map(
				(point) => this.texturesIndex[sector.tiles.get(point.key)!.terrain]
			)
			for (const point of points) {
				const tile = sector.tiles.get(point.key)!
				const position = tile.position

				// Per vertex
				positions.set([position.x, position.y, position.z], index * 3)

				/*const neighbors = neighborsMap.get(point.key)!
				n1.set(neighbors[5], index * 3)
				n2.set(neighbors[4], index * 3)
				n3.set(neighbors[3], index * 3)
				n4.set(neighbors[2], index * 3)
				n5.set(neighbors[1], index * 3)
				n6.set(neighbors[0], index * 3)*/

				// Per triangle
				textureIdx.set(textureIndexes, index * 3)

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
		geometry.setAttribute('position', new BufferAttribute(positions, 3)) /*
		geometry.setAttribute('n1', new BufferAttribute(n1, 3))
		geometry.setAttribute('n2', new BufferAttribute(n2, 3))
		geometry.setAttribute('n3', new BufferAttribute(n3, 3))
		geometry.setAttribute('n4', new BufferAttribute(n4, 3))
		geometry.setAttribute('n5', new BufferAttribute(n5, 3))
		geometry.setAttribute('n6', new BufferAttribute(n6, 3))*/
		return geometry
	}
}

// TODO: `...Textures` should have to be passed as `texture1, texture2, ...`
// TODO: Lighting - normals are calculated already, we just don't feel them
function threeTexturedMaterial(terrainTextures: Texture[], weightMix: string) {
	const nbrTextures = terrainTextures.length
	const terrainTexturesCase = numbers(nbrTextures).map(
		(n) => `if (i == ${n}) return texture2D(terrainTextures[${n}], vUv);`
	)
	return new ShaderMaterial({
		lights: true,
		uniforms: UniformsUtils.merge([
			UniformsLib.lights, // Include light uniforms
			{
				terrainTextures: { value: terrainTextures },
				roadColor: { value: new Color(0xff0000) },
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
/*attribute vec3 n1;
attribute vec3 n2;
attribute vec3 n3;
attribute vec3 n4;
attribute vec3 n5;
attribute vec3 n6;*/
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
uniform sampler2D terrainTextures[${nbrTextures}];

varying vec2 vUv[3];
varying vec3 bary;
varying vec3 vTextureIdx;
//varying vec3 vNormal;
//varying vec3 vViewPosition;
varying vec3 vPosition;

${weightMix}

vec4 tColor(int i, vec2 vUv) {
	${terrainTexturesCase.join('\n')}
	return vec4(1.0, 0.0, 0.0, 1.0);
}

void main() {
	vec4 color1 = tColor(int(round(vTextureIdx.x)), vUv[0]);
	vec4 color2 = tColor(int(round(vTextureIdx.y)), vUv[1]);
	vec4 color3 = tColor(int(round(vTextureIdx.z)), vUv[2]);
	
	vec3 weights = bary2weights(bary);
	// Normalize weights to ensure they sum to 1
	weights /= dot(weights, vec3(1.0));

	// Apply the weights to the colors
	vec4 terrainColor = vec4(color1.rgb * weights.x + color2.rgb * weights.y + color3.rgb * weights.z, 1.0);

	// TODO: lights
	
	gl_FragColor = terrainColor;

}
				`,
	})
}
