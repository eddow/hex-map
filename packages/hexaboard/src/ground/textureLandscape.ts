import {
	BufferAttribute,
	BufferGeometry,
	type Material,
	Mesh,
	type Object3D,
	ShaderMaterial,
	type Texture,
} from 'three'
import { LCG, axial, numbers } from '~/utils'
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
const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}

export function textureUVs(
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

		const positions = new Float32Array(triangles.length * 3 * 3)
		const textureIdx = new Uint8Array(triangles.length * 3 * 3)
		const barycentric = new Float32Array(triangles.length * 3 * 3)
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
				const tile = sector.tiles.get(axial.key(tileCoord))!
				const position = tile.position

				positions.set([position.x, position.y, position.z], index * 3)
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
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		return new Mesh(geometry, this.material)
	}
}

function threeTexturedMaterial(textures: Texture[]) {
	const nbrTextures = textures.length
	const texturesCase = numbers(nbrTextures).map(
		(n) => `if (i == ${n}) return texture2D(textures[${n}], vUv);`
	)
	return new ShaderMaterial({
		uniforms: {
			textures: { value: textures },
		},
		vertexShader: `
varying vec2 vUv[3];
varying vec3 bary;
attribute vec3 barycentric;
attribute vec2 uvA;
attribute vec2 uvB;
attribute vec2 uvC;
attribute vec3 textureIdx;
varying vec3 vTextureIdx;
void main() {
	vUv[0] = uvA;
	vUv[1] = uvB;
	vUv[2] = uvC;
	bary = barycentric;
	vTextureIdx = textureIdx;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
				`,
		fragmentShader: `
uniform sampler2D textures[${nbrTextures}];
varying vec2 vUv[3];
varying vec3 bary;
varying vec3 vTextureIdx;

float influence(float coord) {
	return coord * coord; // Quadratic function scaled to reach 1 at coord = 0.5
}

vec4 tColor(sampler2D textures[${nbrTextures}], int i, vec2 vUv) {
	${texturesCase.join('\n')}
	return vec4(1.0, 0.0, 0.0, 1.0);
}

void main() {
	vec4 color1 = tColor(textures, int(round(vTextureIdx.x)), vUv[0]);
	vec4 color2 = tColor(textures, int(round(vTextureIdx.y)), vUv[1]);
	vec4 color3 = tColor(textures, int(round(vTextureIdx.z)), vUv[2]);
	
	// Compute weights
	float weight1 = influence(bary.x);
	float weight2 = influence(bary.y);
	float weight3 = influence(bary.z);

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
}
