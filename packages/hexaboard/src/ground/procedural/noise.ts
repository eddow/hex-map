import { numbers } from '~/utils/numbers'
import { HeightMap } from '~/utils/perlin'
import { type Axial, axial, cartesian } from '../../utils/axial'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'
import { ProceduralBase } from './procedural'

export class NoiseProcedural extends ProceduralBase<TileBase> {
	readonly perlin: HeightMap
	constructor(
		radius: number,
		terrainHeight: number,
		public readonly worldSeed: number,
		perlinZoomFactor = 0.05
	) {
		super(radius, terrainHeight)
		this.perlin = new HeightMap(worldSeed, 10, [0, terrainHeight])
	}
	listTiles(land: LandBase, { center }: { center: Axial }): TileBase[] {
		return numbers(this.nbrTiles).map((hexIndex): TileBase => {
			const { x, y } = cartesian(axial.linear([1, axial.coords(hexIndex)], [1, center]))
			const z = this.perlin.getHeight(x, y)
			return {
				z,
				terrain: land.terrains.terrainType(z),
			}
		})
	}
}
