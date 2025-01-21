import { LCG, type RandGenerator } from '~/utils/numbers'
import { type Axial, axialIndex, axialPolynomial, hexSides, hexTiles } from '../hexagon'
import type { LandBase } from '../land'
import type { TileBase } from '../sector'
import type { TerrainBase } from '../terrain'
import { ProceduralBase } from './procedural'

export interface Pow2Terrain extends TerrainBase {
	variance: number
}

export interface Pow2Tile extends TileBase {
	terrain: Pow2Terrain
	seed: number
}

export abstract class Pow2Procedural<
	Tile extends Pow2Tile = Pow2Tile,
	Terrain extends Pow2Terrain = Pow2Terrain,
> extends ProceduralBase<Tile> {
	constructor(public readonly scale: number) {
		super(1 + (1 << scale))
	}
	listTiles(land: LandBase<Tile, Terrain>, gen: RandGenerator): Tile[] {
		const tiles = new Array(this.nbrTiles).fill(null)
		const corners = hexSides.map((side) => axialPolynomial([1 << this.scale, side]))
		this.initCorners(tiles, corners.map(axialIndex), gen)
		for (let c = 0; c < 6; c++)
			this.divTriangle(land, tiles, this.scale, corners[c], corners[(c + 1) % 6], { q: 0, r: 0 })

		return tiles
	}

	divTriangle(land: LandBase<Tile, Terrain>, tiles: Tile[], scale: number, ...triangle: Axial[]) {
		if (scale === 0) return

		const points = triangle.map(axialIndex)
		const mids = triangle.map((a, i) => axialPolynomial([0.5, a], [0.5, triangle[(i + 1) % 3]]))
		const midPoints = mids.map(axialIndex)
		for (let i = 0; i < 3; i++)
			if (!tiles[midPoints[i]])
				tiles[midPoints[i]] = this.insidePoint(
					land,
					tiles[points[i]],
					tiles[points[(i + 1) % 3]],
					scale
				) as Tile
		if (scale > 0) {
			this.divTriangle(land, tiles, scale - 1, ...mids)
			for (let i = 0; i < 3; i++)
				this.divTriangle(land, tiles, scale - 1, triangle[i], mids[i], mids[(i + 2) % 3])
		}
	}

	abstract initCorners(tiles: Tile[], corners: number[], gen: RandGenerator): void
	insidePoint(land: LandBase<Tile, Terrain>, p1: Tile, p2: Tile, scale: number): Pow2Tile {
		const variance = (p1.terrain.variance + p2.terrain.variance) / 2
		const randScale = ((1 << scale) / this.radius) * land.terrains.terrainHeight * variance
		const seed = LCG(p1.seed, p2.seed)()
		const gen = LCG(seed)
		const z = (p1.z + p2.z) / 2 + gen(0.5, -0.5) * randScale
		const changeType = gen() < scale / this.scale
		const terrain = changeType ? land.terrains.terrainType(z) : [p1, p2][Math.floor(gen(2))].terrain
		return { z, terrain, seed }
	}
	/**
	 * Total amount of tiles
	 */
	get nbrTiles() {
		return hexTiles(this.radius)
	}
}
