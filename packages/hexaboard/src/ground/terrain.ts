import type { Texture } from 'three'

export interface Terrain {
	color: { r: number; g: number; b: number }
	appearHeight: number
	texture: Texture
}

export class TerrainDefinition {
	constructor(public readonly types: Record<string, Terrain>) {}
	terrainType(height: number): string {
		let rvH: number | undefined
		let rvT: undefined | string
		for (const type in this.types) {
			const tType = this.types[type as keyof typeof this.types]
			const thisH = tType.appearHeight
			if (height >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = type
			}
		}
		return rvT!
	}
	get textures() {
		return Object.values(this.types).map((t) => t.texture)
	}
}
