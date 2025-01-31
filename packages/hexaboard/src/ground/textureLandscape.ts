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
import type { HandledMouseEvents } from '~/mouse'
import type { Triplet } from '~/types'
import { type AxialKey, AxialKeyMap, Eventful, LCG, axial, numbers } from '~/utils'
import type { RenderedEvents } from './land'
import type { Landscape, LandscapeTriangle, TileHandle } from './landscaper'
import type { RoadBase, RoadKey } from './road'
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

const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}

// TODO: Now, side is 0 or 1, optimize ?
function textureUVs(
	{ alpha, inTextureRadius, center: { u, v } }: TexturePosition,
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

export class TextureLandscape<Tile extends TerrainTile = TerrainTile>
	extends Eventful<HandledMouseEvents<TileHandle<Tile>> & RenderedEvents<Tile>>
	implements Landscape<Tile>
{
	public readonly material: Material
	public readonly mouseReactive = true
	private readonly textures: Texture[]
	private texturesIndex: Record<TerrainKey, number>
	constructor(
		private readonly terrainDefinition: TerrainDefinition<TextureTerrain>,
		private readonly roadDefinition: Record<RoadKey, RoadBase>,
		private readonly seed: number
	) {
		super()
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
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		// Gather the texture positions
		const { seed, terrainDefinition } = this
		const textureUvCache = new AxialKeyMap(
			(function* () {
				for (const [i, tile] of sector.tiles) {
					const coord = axial.keyAccess(i)
					const gen = LCG(seed, 'terrainTextures', coord.q, coord.r)
					yield [
						i,
						{
							alpha: gen(Math.PI * 2),
							inTextureRadius: terrainDefinition.types[tile.terrain].inTextureRadius,
							center: {
								u: gen(),
								v: gen(),
							},
						},
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
		return new Mesh(geometry, this.material)
	}
}

// TODO: `...Textures` should have to be passed as `texture1, texture2, ...`
// TODO: Lighting - normals are calculated already, we just don't feel them
function threeTexturedMaterial(terrainTextures: Texture[]) {
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

float influence(float coord) {
	return coord * coord; // Quadratic function scaled to reach 1 at coord = 0.5
}

vec4 tColor(int i, vec2 vUv) {
	${terrainTexturesCase.join('\n')}
	return vec4(1.0, 0.0, 0.0, 1.0);
}


void main() {
	vec4 color1 = tColor(int(round(vTextureIdx.x)), vUv[0]);
	vec4 color2 = tColor(int(round(vTextureIdx.y)), vUv[1]);
	vec4 color3 = tColor(int(round(vTextureIdx.z)), vUv[2]);
	
	// Normalize weights to ensure they sum to 1
	vec3 weights = vec3(influence(bary.x), influence(bary.y), influence(bary.z));
	float sum = dot(weights, vec3(1.0)); // Sum of weights
	weights /= sum; // Normalize weights

	// Apply the weights to the colors
	vec4 terrainColor = vec4(color1.rgb * weights.x + color2.rgb * weights.y + color3.rgb * weights.z, 1.0);

	// TODO: lights
	
	gl_FragColor = terrainColor;

}
				`,
	})
}
