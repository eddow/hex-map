import { LCG, numbers } from '~/utils/numbers'
import { Perlin } from '~/utils/perlin'
import { type Axial, axial, cartesian } from '../../utils/axial'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'
import { ProceduralBase } from './procedural'

export class NoiseProcedural extends ProceduralBase<TileBase> {
	readonly perlin: Perlin
	constructor(
		radius: number,
		terrainHeight: number,
		public readonly worldSeed: number
	) {
		super(radius, terrainHeight)
		this.perlin = new Perlin(LCG(worldSeed))
	}
	listTiles(land: LandBase, { center }: { center: Axial }): TileBase[] {
		return numbers(this.nbrTiles).map((hexIndex): TileBase => {
			const { x, y } = cartesian(axial.linear([1, axial.coords(hexIndex)], [1, center]))
			const z = this.perlin.heightMap({ x, y }, this.terrainHeight)
			return {
				z,
				terrain: land.terrains.terrainType(z),
			}
		})
	}
}
