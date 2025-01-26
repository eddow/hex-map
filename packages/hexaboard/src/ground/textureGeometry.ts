import { BufferAttribute, BufferGeometry, type Material, ShaderMaterial, type Texture } from 'three'
import { LCG, numbers } from '~/utils'
import { assert } from '~/utils/debug'
import { performanceMeasured } from '~/utils/decorators'
import type { RenderedTile, Triplet } from './landscaper'
import type { Landscape, TileRenderBase, TriangleBase } from './landscaper'
import type { TerrainDefinition } from './terrain'

interface TexturePosition {
	alpha: number
	center: { u: number; v: number }
}

interface TexturedTileRender extends TileRenderBase<TexturedTriangle> {
	textureCenter: { u: number; v: number }
	uvCache: number[][]
}

interface TexturedTriangle extends TriangleBase {
	uvA: number[]
	uvB: number[]
	uvC: number[]
	textureIdx: number[]
}

const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}

function uvCache(texture: TexturePosition) {
	const { u, v } = texture.center
	const scAlpha = {
		cos: inTextureRadius * Math.cos(texture.alpha),
		sin: inTextureRadius * Math.sin(texture.alpha),
	}
	return numbers(6).map((side) => [
		u + scAlpha.cos * scSummits[side].cos - scAlpha.sin * scSummits[side].sin,
		v + scAlpha.cos * scSummits[side].sin + scAlpha.sin * scSummits[side].cos,
	])
}

// Textures are images virtually of size 1x1 - this is the size of the part of the picture taken by tiles
const inTextureRadius = 0.2
export function textureUVs(
	{ u, v }: { u: number; v: number },
	uvCache: number[][],
	side: number,
	rot: number
) {
	const [bp1u, bp1v] = uvCache[(rot + side + 1) % 6]
	const [bp2u, bp2v] = uvCache[(rot + side) % 6]
	// Since rot will be 0, 2, or 4, we can directly adjust the array without slicing:
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

export class TextureGeometry implements Landscape<TexturedTriangle, TexturedTileRender> {
	public readonly material: Material
	public readonly mouseReactive = true
	private readonly textures: Texture[]
	private texturesIndex: Record<string, number>

	constructor(
		private readonly terrainDefinition: TerrainDefinition,
		private readonly seed: number
	) {
		this.textures = terrainDefinition.textures
		this.material = threeTexturedMaterial(terrainDefinition.textures)

		// Index of all the textures by terrain type name
		this.texturesIndex = Object.fromEntries(
			Object.entries(this.terrainDefinition.types).map(([k, v]) => [
				k,
				this.textures.indexOf(v.texture),
			])
		)
	}

	@performanceMeasured('texture geometry')
	createGeometry(
		tiles: Map<string, RenderedTile<TexturedTriangle, TexturedTileRender>>,
		triangles: TexturedTriangle[]
	): BufferGeometry {
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
			const { tilesKey } = triangle
			uvA.set(triangle.uvA, index * 2)
			uvB.set(triangle.uvB, index * 2)
			uvC.set(triangle.uvC, index * 2)
			//textureIdx.set(triangle.textureIdx, index * 3)
			const textureIndexes = tilesKey.map(
				(tileKey) => this.texturesIndex[tiles.get(tileKey)!.nature!.terrain]
			)
			for (const tileKey of tilesKey) {
				const tile = tiles.get(tileKey)
				assert(tile?.nature, 'Rendered point has a nature')
				const position = tile.nature.position

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
		return geometry
	}
	tileRender(render: TileRenderBase<TexturedTriangle>, key: string): TexturedTileRender {
		//const { q, r } = axial.coords(key)
		//const gen = LCG(this.seed, 'ttr', q, r)
		const gen = LCG(this.seed, 'ttr', key)
		const texturePosition = {
			alpha: gen(Math.PI * 2),
			center: {
				u: gen(),
				v: gen(),
			},
		}
		return {
			...render,
			textureCenter: texturePosition.center,
			uvCache: uvCache(texturePosition),
		}
	}
	triangle(
		triangle: TriangleBase,
		tiles: Triplet<RenderedTile<TexturedTriangle, TexturedTileRender>>
	): TexturedTriangle {
		const textureIdx = tiles.map((tile) => this.texturesIndex[tile.nature!.terrain])
		const [A, B, C] = tiles.map((tile) => tile.rendered!)
		const side = triangle.side
		return {
			...triangle,
			textureIdx: [...textureIdx, ...textureIdx, ...textureIdx],
			uvA: textureUVs(A.textureCenter, A.uvCache, side, 0),
			uvB: textureUVs(B.textureCenter, B.uvCache, side, 4),
			uvC: textureUVs(C.textureCenter, C.uvCache, side, 2),
		}
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
