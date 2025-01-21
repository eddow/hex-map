import { type RandGenerator, numbers } from '~/utils/numbers'
import { Perlin } from '~/utils/perlin'
import { axialAt, cartesian } from '../hexagon'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'
import { ProceduralBase } from './procedural'

export class NoiseProcedural extends ProceduralBase<TileBase> {
	readonly perlin: Perlin
	constructor(radius: number) {
		super(radius)
		this.perlin = new Perlin(Math.random)
	}
	listTiles(land: LandBase, gen: RandGenerator): TileBase[] {
		return numbers(this.nbrTiles).map((hexIndex): TileBase => {
			const { x, y } = cartesian(axialAt(hexIndex))
			const z = this.perlin.heightMap({ x, y }, 80)
			return {
				z,
				terrain: land.terrains.terrainType(z),
			}
		})
	}
}
