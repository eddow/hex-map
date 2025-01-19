import type { Texture } from 'three'
import type { RandGenerator } from '~/utils/misc'
import type { ResourceDistribution } from '../game/handelable'

const inTextureRadius = 0.2
export interface TerrainTexture {
	center: { u: number; v: number }
	alpha: number
	texture: Texture
}

export function genTexture(gen: RandGenerator) {
	return {
		center: { u: gen(), v: gen() },
		alpha: gen(Math.PI * 2),
	}
}

export function textureUVs(texture: TerrainTexture, side: number, rot: number) {
	const { u, v } = texture.center
	const outP = (side: number) => [
		u + inTextureRadius * Math.cos(texture.alpha + ((side + rot) * Math.PI) / 3),
		v + inTextureRadius * Math.sin(texture.alpha + ((side + rot) * Math.PI) / 3),
	]
	const arr = [u, v, ...outP(side + 1), ...outP(side)]
	return arr.slice(rot, 6).concat(arr.slice(0, rot))
}

export interface TerrainType {
	appearHeight: number
	variance: number
	resourceDistribution: ResourceDistribution
	texture: Texture
}

export class TerrainsDefinition {
	constructor(
		public readonly terrainTypes: Record<string, TerrainType>,
		public readonly waterTexture: Texture,
		public readonly terrainHeight: number,
		public readonly terrains: { center: TerrainType; perimeter: TerrainType }
	) {}
	terrainType(height: number): TerrainType {
		let rvH: number | undefined
		let rvT: undefined | TerrainType
		for (const type in this.terrainTypes) {
			const tType = this.terrainTypes[type as keyof typeof this.terrainTypes]
			const thisH = tType.appearHeight
			if (height / this.terrainHeight >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = tType
			}
		}
		return rvT!
	}
}
