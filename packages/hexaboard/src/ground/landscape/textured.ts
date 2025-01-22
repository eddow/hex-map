import {
	type BufferGeometry,
	Float32BufferAttribute,
	Int16BufferAttribute,
	type Material,
	ShaderMaterial,
	type Texture,
} from 'three'
import { numbers } from '~/utils/numbers'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandscapeBase, type PositionGeometryAttribute, type PositionPointInfo } from './landscape'

const inTextureRadius = 0.2
export interface TexturePosition {
	center: { u: number; v: number }
	alpha: number
}

export function textureUVs(texture: TexturePosition, side: number, rot: number) {
	const { u, v } = texture.center
	const outP = (side: number) => [
		u + inTextureRadius * Math.cos(texture.alpha + ((side + rot) * Math.PI) / 3),
		v + inTextureRadius * Math.sin(texture.alpha + ((side + rot) * Math.PI) / 3),
	]
	const arr = [u, v, ...outP(side + 1), ...outP(side)]
	return arr.slice(rot, 6).concat(arr.slice(0, rot))
}

export interface TexturedTerrain extends TerrainBase {
	texture: Texture
}

export interface TexturedTile extends TileBase<TexturedTerrain> {}

export interface TexturedPointInfo extends PositionPointInfo {
	textureIdx: number
	uv: (side: number, rot: number) => number[]
}
export interface TexturedGeometryAttribute extends PositionGeometryAttribute {
	barycentric: number[]
	textureIdx: number[]
	uvA: number[]
	uvB: number[]
	uvC: number[]
}

export class DynamicTexturedLandscape<
	Tile extends TexturedTile = TexturedTile,
	PointInfo extends TexturedPointInfo = TexturedPointInfo,
	GeometryAttribute extends TexturedGeometryAttribute = TexturedGeometryAttribute,
> extends LandscapeBase<Tile, TexturedPointInfo, GeometryAttribute> {
	constructor(
		tileSize: number,
		public readonly textures: Texture[] = []
	) {
		super(tileSize)
	}
	get initialGeometryAttributes(): GeometryAttribute {
		return {
			...super.initialGeometryAttributes,
			barycentric: [],
			textureIdx: [],
			uvA: [],
			uvB: [],
			uvC: [],
		}
	}
	textureIdx(texture: Texture): number {
		let textureIdx = this.textures.indexOf(texture)
		if (textureIdx < 0) {
			textureIdx = this.textures.length
			this.textures.push(texture)
		}
		return textureIdx
	}
	geometryPointInfos(sector: Sector<Tile>, hexIndex: number): TexturedPointInfo {
		const p = sector.tiles[hexIndex]
		let textureIdx = this.textureIdx(p.terrain.texture)

		const gen = sector.tileGen(hexIndex)

		const texturePosition = {
			center: { u: gen(), v: gen() },
			alpha: gen(Math.PI * 2),
		}
		if (textureIdx < 0) {
			textureIdx = this.textures.length
			this.textures.push(p.terrain.texture)
		}
		return {
			...super.geometryPointInfos(sector, hexIndex),
			textureIdx,
			uv: (side, rot) => textureUVs(texturePosition, side, rot),
		}
	}
	addGeometryAttributes(
		geometryAttributes: GeometryAttribute,
		pointsInfo: [PointInfo, PointInfo, PointInfo],
		side: number
	): void {
		const [A, B, C] = pointsInfo
		super.addGeometryAttributes(geometryAttributes, pointsInfo, side)
		geometryAttributes.barycentric.push(1, 0, 0, 0, 1, 0, 0, 0, 1) // Allows to calculate the weighting of each vertex texture
		// Repeated thrice, so that the 3 indexes are the same all along the rendered triangle
		const textureIdx = [A.textureIdx, B.textureIdx, C.textureIdx]
		geometryAttributes.textureIdx.push(...textureIdx, ...textureIdx, ...textureIdx)

		geometryAttributes.uvA.push(...A.uv(side, 0))
		geometryAttributes.uvB.push(...B.uv(side, 4))
		geometryAttributes.uvC.push(...C.uv(side, 2))
	}
	createGeometry(sector: Sector<Tile>): BufferGeometry {
		return super.createGeometry(sector)
	}
	setGeometryAttributes(geometry: BufferGeometry, attributes: GeometryAttribute): void {
		super.setGeometryAttributes(geometry, attributes)
		geometry.setAttribute('barycentric', new Float32BufferAttribute(attributes.barycentric, 3))
		geometry.setAttribute('textureIdx', new Int16BufferAttribute(attributes.textureIdx, 3))
		geometry.setAttribute('uvA', new Float32BufferAttribute(attributes.uvA, 2))
		geometry.setAttribute('uvB', new Float32BufferAttribute(attributes.uvB, 2))
		geometry.setAttribute('uvC', new Float32BufferAttribute(attributes.uvC, 2))
	}
	generateMaterial(): Material {
		const nbrTextures = this.textures.length
		const texturesCase = numbers(nbrTextures).map(
			(n) => `if (i == ${n}) return texture2D(textures[${n}], vUv);`
		)
		return new ShaderMaterial({
			uniforms: {
				textures: { value: this.textures },
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
	createMaterial(): Material {
		return this.generateMaterial()
	}
}

/**
 * Make one and only one material, but has to specify all the used texture at constructor
 */
export class TexturedLandscape<
	Tile extends TexturedTile = TexturedTile,
	PointInfo extends TexturedPointInfo = TexturedPointInfo,
	GeometryAttribute extends TexturedGeometryAttribute = TexturedGeometryAttribute,
> extends DynamicTexturedLandscape<Tile, PointInfo, GeometryAttribute> {
	private readonly oneMaterial: Material
	constructor(tileSize: number, textures: Texture[]) {
		super(tileSize, textures)
		this.oneMaterial = this.generateMaterial()
	}
	createMaterial(): Material {
		return this.oneMaterial
	}
}
