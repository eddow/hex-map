import type { RandGenerator } from '~/utils/random'

const texturesSize = 512
export interface TerrainTexture {
	center: { u: number; v: number }
	alpha: number
}

export function genTexture(gen: RandGenerator) {
	return {
		center: { u: gen(texturesSize), v: gen(texturesSize) },
		alpha: gen(Math.PI * 2),
	}
}
