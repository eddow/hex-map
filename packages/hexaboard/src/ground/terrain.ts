export interface TerrainBase {
	color: { r: number; g: number; b: number }
	appearHeight: number
}

export class TerrainDefinition<Terrain extends TerrainBase = TerrainBase> {
	constructor(public readonly terrainTypes: Record<string, Terrain>) {}
	terrainType(height: number): Terrain {
		// TODO: kill me
		//if (height < 0) debugger
		let rvH: number | undefined
		let rvT: undefined | Terrain
		for (const type in this.terrainTypes) {
			const tType = this.terrainTypes[type as keyof typeof this.terrainTypes]
			const thisH = tType.appearHeight
			if (height >= thisH && (rvH === undefined || thisH > rvH)) {
				rvH = thisH
				rvT = tType
			}
		}
		return rvT!
	}
}
