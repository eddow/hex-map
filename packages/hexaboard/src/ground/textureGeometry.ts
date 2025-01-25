import { BufferAttribute, BufferGeometry, type Material, ShaderMaterial, type Texture } from 'three'
import { LCG, axial, numbers } from '~/utils'
import { assert } from '~/utils/debug'
import type { RenderedTile, Triplet } from './landscape'
import type { GeometryBuilder, TileRenderBase, TriangleBase } from './landscape'
import type { TerrainDefinition } from './terrain'

interface TexturePosition {
	alpha: number
	center: { u: number; v: number }
}

interface TexturedTileRender extends TileRenderBase<TexturedTriangle> {
	texturePosition: TexturePosition
}

interface TexturedTriangle extends TriangleBase {
	uvA: number[]
	uvB: number[]
	uvC: number[]
	textureIdx: number[]
}

// Textures are images virtually of 1x1 - this is the size of the part of the picture taken by tiles
const inTextureRadius = 0.2
export function textureUVs(texture: TexturePosition, side: number, rot: number) {
	const { u, v } = texture.center
	const rotationAngle = (rot * Math.PI) / 3 // Pre-calculate rotation angle

	// Helper function to compute coordinates
	const computePoint = (offset: number) => [
		u + inTextureRadius * Math.cos(texture.alpha + rotationAngle + (offset * Math.PI) / 3),
		v + inTextureRadius * Math.sin(texture.alpha + rotationAngle + (offset * Math.PI) / 3),
	]

	const basePoints = [[u, v], computePoint(1), computePoint(0)]

	// Since rot will be 0, 2, or 4, we can directly adjust the array without slicing:
	switch (rot) {
		case 0:
			return basePoints.flat()
		case 2:
			return [basePoints[1], basePoints[2], basePoints[0]].flat()
		case 4:
			return [basePoints[2], basePoints[0], basePoints[1]].flat()
		default:
			throw new Error('Invalid rotation value')
	}
}

export class TextureGeometry implements GeometryBuilder<TexturedTriangle, TexturedTileRender> {
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
			textureIdx.set(triangle.textureIdx, index * 3)

			for (const tileKey of tilesKey) {
				const tile = tiles.get(tileKey)
				assert(tile?.nature, 'Rendered point has a nature')
				const position = tile.nature.position

				positions.set([position.x, position.y, position.z], index * 3)

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
		const { q, r } = axial.coords(key)
		const gen = LCG(this.seed, 'ttr', q, r)
		return {
			...render,
			texturePosition: {
				alpha: gen(Math.PI * 2),
				center: {
					u: gen(),
					v: gen(),
				},
			},
		}
	}
	triangle(
		triangle: TriangleBase,
		tiles: Triplet<RenderedTile<TexturedTriangle, TexturedTileRender>>
	): TexturedTriangle {
		const textureIdx = tiles.map((tile) => this.texturesIndex[tile.nature!.terrain])
		const [A, B, C] = tiles.map((tile) => tile.rendered!.texturePosition)
		const side = triangle.side
		return {
			...triangle,
			textureIdx: [...textureIdx, ...textureIdx, ...textureIdx],
			uvA: textureUVs(A, side, 0),
			uvB: textureUVs(B, side, 4),
			uvC: textureUVs(C, side, 2),
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
