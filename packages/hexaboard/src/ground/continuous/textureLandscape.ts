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
import { type Axial, type AxialCoord, type RandGenerator, numbers } from '~/utils'
import { WorkerManager, extractFunctionParts } from '~/utils/workers'
import type { TerrainBase, TerrainKey, TerrainTile } from '../perlinTerrain'
import type { Sector } from '../sector'
import { CompleteLandscape } from './completeLandscape'
import type { LandscapeTriangle } from './landscape'
import type { ContinuousTextureLandscapeWorker } from './textureLandscape.worker'
import CreateGeometryWorker from './textureLandscape.worker.ts?worker&url'

interface TexturePosition {
	alpha: number
	radius: number
	center: { u: number; v: number }
}
export interface TextureTerrain extends TerrainBase {
	texture: Texture
}
export interface SeamlessTextureInfo {
	// Textures are images virtually of size 1x1 - this is the size of the part of the picture taken by tiles
	inTextureRadius: number
}
export interface SeamlessTextureTerrain extends TextureTerrain, SeamlessTextureInfo {}

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

export interface TileTextureStyle<Terrain = unknown> {
	/**
	 * GLSL texture mixer for borders
	 */
	weightMix: string
	/**
	 * Choose which part of the texture is rendered around a point
	 * @param point
	 * @returns
	 */
	texturePosition(terrain: Terrain, point: Axial, gen: RandGenerator): TexturePosition
	extract?(terrain: Terrain): Terrain
}

export const textureStyle = {
	seamless(degree: number): TileTextureStyle<SeamlessTextureInfo> {
		return {
			weightMix: weightMix.polynomial(degree),
			texturePosition(terrain, point, gen: RandGenerator) {
				return {
					alpha: gen(Math.PI * 2),
					radius: terrain.inTextureRadius,
					center: {
						u: gen(),
						v: gen(),
					},
				}
			},
			extract(terrain) {
				return {
					inTextureRadius: terrain.inTextureRadius,
				}
			},
		}
	},
	// TODO: `pick in many` - give a texture with many variations in a matrix-like picture and pick one
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

const workers = new WorkerManager<ContinuousTextureLandscapeWorker>(CreateGeometryWorker)

export class ContinuousTextureLandscape<
	Tile extends TerrainTile = TerrainTile,
	Terrain extends TextureTerrain = TextureTerrain,
> extends CompleteLandscape<Tile> {
	public readonly material: Material
	private readonly textures: Texture[]
	private texturesIndex: Record<TerrainKey, number>
	constructor(
		private readonly sectorRadius: number,
		private readonly terrainTypes: Record<TerrainKey, Terrain>,
		private readonly textureStyle: TileTextureStyle
	) {
		super(sectorRadius)
		this.textures = Array.from(new Set(Object.values(terrainTypes).map((t) => t.texture)))
		this.material = threeTexturedMaterial(this.textures, textureStyle.weightMix)

		// Index of all the textures by terrain type name
		this.texturesIndex = Object.fromEntries(
			Object.entries(this.terrainTypes).map(([k, v]) => [k, this.textures.indexOf(v.texture)])
		)
	}
	async createGeometry(sector: Sector<Tile>, genericTriangles: LandscapeTriangle<AxialCoord>[]) {
		const geometry = new BufferGeometry()
		const { textureStyle, terrainTypes, texturesIndex } = this

		const barycentric = new Float32Array(genericTriangles.length * 3 * 3)
		// Bary-centers allow the shaders to know the distance of a fragment toward a vertex
		barycentric.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0)
		// Exponentially copy the constant points
		for (let multiplier = 1; multiplier < genericTriangles.length; multiplier <<= 1)
			((m) => barycentric.copyWithin(m, 0, m))(multiplier * 9)
		//*
		const { uvA, uvB, uvC, textureIdx, positions } = await workers.run(
			Array.from(
				sector.tiles.entries().map(([point, tile]) => [
					point,
					{
						position: [tile.position.x, tile.position.y, tile.position.z],
						terrain: tile.terrain,
					},
				])
			),
			this.sectorRadius,
			sector.center,
			{
				weightMix: textureStyle.weightMix,
				texturePosition: extractFunctionParts(textureStyle.texturePosition),
			},
			textureStyle.extract
				? Object.fromEntries(
						Object.entries(terrainTypes).map(([k, v]) => [k, textureStyle.extract!(v as any)])
					)
				: {},
			texturesIndex
		)

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
