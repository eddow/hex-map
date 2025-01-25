import type { Texture } from 'three'

export interface Terrain {
	color: { r: number; g: number; b: number }
	appearHeight: number
	texture: Texture
}

export class TerrainDefinition {
	constructor(public readonly terrainTypes: Record<string, Terrain>) {}
	terrainType(height: number): string {
		let rvH: number | undefined
		let rvT: undefined | string
		for (const type in this.terrainTypes) {
			const tType = this.terrainTypes[type as keyof typeof this.terrainTypes]
			const thisH = tType.appearHeight
			if (height >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = type
			}
		}
		return rvT!
	}
	get textures() {
		return Object.values(this.terrainTypes).map((t) => t.texture)
	}
}
