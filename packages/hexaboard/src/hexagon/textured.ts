import {
	type BufferGeometry,
	Float32BufferAttribute,
	Group,
	Int16BufferAttribute,
	ShaderMaterial,
	type Texture,
	type Vector3,
} from 'three'
import {
	type Handelable,
	type TerrainTexture,
	type TerrainType,
	genTexture,
	generateResources,
	terrainContentRadius,
	textureUVs,
} from '~/game'
import { LCG, type RandGenerator, numbers } from '~/utils'
import HexPow2Gen, { type HeightTile } from './pow2gen'
import type { PositionGeometryAttribute, PositionPointInfo } from './sector'
import { type Axial, hexTiles, posInTile } from './utils'

export interface TexturedTile extends HeightTile {
	type: TerrainType
	seed: number
	content: (Handelable | undefined)[]
	texture: TerrainTexture
}

export interface TexturedPointInfo extends PositionPointInfo {
	position: Vector3
	textureIdx: number
}
export interface TexturedGeometryAttribute extends PositionGeometryAttribute {
	position: number[]
	barycentric: number[]
	textureIdx: number[]
	uvA: number[]
	uvB: number[]
	uvC: number[]
}

export abstract class HeightPowGen<
	Tile extends TexturedTile = TexturedTile,
	PointInfo extends TexturedPointInfo = TexturedPointInfo,
	GeometryAttribute extends TexturedGeometryAttribute = TexturedGeometryAttribute,
> extends HexPow2Gen<Tile, PointInfo, GeometryAttribute> {
	heightTile(z: number, type: TerrainType, gen: RandGenerator, seed?: number): TexturedTile {
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
	insidePoint(p1: Tile, p2: Tile, scale: number): Tile {
		const variance = (p1.type.variance + p2.type.variance) / 2
		const randScale = ((1 << scale) / this.radius) * this.terrains.terrainHeight * variance
		const seed = LCG(p1.seed, p2.seed)()
		const gen = LCG(seed)
		const z = (p1.z + p2.z) / 2 + gen(0.5, -0.5) * randScale
		const changeType = gen() < scale / this.scale
		const type = changeType ? this.terrains.terrainType(z) : [p1, p2][Math.floor(gen(2))].type
		return this.heightTile(z, type, gen, seed) as Tile
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
	populatePoint(p: TexturedTile, position: Axial, hexIndex: number): void {
		const gen = LCG(p.seed + 0.2)
		if (p.z > 0)
			p.content = Array.from(generateResources(gen, p.type, hexTiles(terrainContentRadius + 1)))
	}

	// #region Geometry

	texturedMeshBuilding?: {
		textures: Texture[]
	}
	protected mesh1() {
		this.texturedMeshBuilding = { textures: [] }
		try {
			return super.mesh1()
		} finally {
			this.texturedMeshBuilding = undefined
		}
	}
	protected get initialGeometryAttributes() {
		return {
			...super.initialGeometryAttributes,
			barycentric: [],
			textureIdx: [],
			uvA: [],
			uvB: [],
			uvC: [],
		}
	}
	protected geometryPointInfos(hexIndex: number): PointInfo {
		const p = this.points[hexIndex]
		if (!this.texturedMeshBuilding) throw new Error('No geometry building')
		let textureIdx = this.texturedMeshBuilding.textures.indexOf(p.texture.texture)
		if (textureIdx < 0) {
			textureIdx = this.texturedMeshBuilding.textures.length
			this.texturedMeshBuilding.textures.push(p.texture.texture)
		}
		return {
			...super.geometryPointInfos(hexIndex),
			textureIdx,
		}
	}
	protected addGeometryAttributes(
		geometryAttributes: GeometryAttribute,
		hexIndexes: [number, number, number],
		pointInfos: [PointInfo, PointInfo, PointInfo],
		side: number
	) {
		const [a, b, c] = hexIndexes
		const [A, B, C] = pointInfos
		super.addGeometryAttributes(geometryAttributes, hexIndexes, pointInfos, side)
		geometryAttributes.barycentric.push(1, 0, 0, 0, 1, 0, 0, 0, 1) // Allows to calculate the weighting of each vertex texture
		// Repeated thrice, so that the 3 indexes are the same all along the rendered triangle
		const textureIdx = [A.textureIdx, B.textureIdx, C.textureIdx]
		geometryAttributes.textureIdx.push(...textureIdx, ...textureIdx, ...textureIdx)

		const points = [a, b, c].map((n) => this.points[n])
		geometryAttributes.uvA.push(...textureUVs(points[0].texture, side, 0))
		geometryAttributes.uvB.push(...textureUVs(points[1].texture, side, 4))
		geometryAttributes.uvC.push(...textureUVs(points[2].texture, side, 2))
	}
	protected setGeometryAttributes(geometry: BufferGeometry, attributes: GeometryAttribute) {
		super.setGeometryAttributes(geometry, attributes)
		geometry.setAttribute('barycentric', new Float32BufferAttribute(attributes.barycentric, 3))
		geometry.setAttribute('textureIdx', new Int16BufferAttribute(attributes.textureIdx, 3))
		geometry.setAttribute('uvA', new Float32BufferAttribute(attributes.uvA, 2))
		geometry.setAttribute('uvB', new Float32BufferAttribute(attributes.uvB, 2))
		geometry.setAttribute('uvC', new Float32BufferAttribute(attributes.uvC, 2))
	}
	get material() {
		const nbrTextures = this.texturedMeshBuilding!.textures.length
		const texturesCase = numbers(nbrTextures).map(
			(n) => `if (i == ${n}) return texture2D(textures[${n}], vUv);`
		)
		return new ShaderMaterial({
			uniforms: {
				textures: { value: this.texturedMeshBuilding!.textures },
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

	// #endregion
}
