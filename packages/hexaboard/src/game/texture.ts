import { Float32BufferAttribute, type Texture } from 'three'
import type { RandGenerator } from '~/utils/random'

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
	return new Float32BufferAttribute(arr.slice(rot, 6).concat(arr.slice(0, rot)), 2)
}
