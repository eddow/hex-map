import { LCG, subSeed } from '~/utils/numbers'
import { type Axial, type AxialRef, axial, cartesian } from '../../utils/axial'
import type { TileBase } from '../sector'
import Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandBase } from './land'

function sector2tile(aRef: AxialRef, radius = 1) {
	const { q, r } = axial.coords(aRef)
	return axial.linear([q * radius, { q: 1, r: 1 }], [r * radius, { q: 2, r: -1 }])
}

export class PuzzleSector<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends Sector<Tile> {
	public color: number
	constructor(
		land: LandBase,
		tiles: Tile[],
		seed: number,
		public readonly center: Axial
	) {
		super(land, tiles, seed)
		const gen = LCG(seed)
		this.color = gen(0x1000000)
	}
	/*get nbrTiles(): number {
		const radius = this.land.procedural.radius - 1
		return hexTiles(radius) + 2 * radius
	}*/
	tileGen(aRef: AxialRef) {
		const { q: qs, r: rs } = sector2tile(this.center)
		const { q, r } = axial.coords(aRef)
		return LCG('puzzle-tile', qs + q, rs + r)
	}
	worldTile(aRef: AxialRef) {
		const { q: qs, r: rs } = sector2tile(this.center)
		const { q, r } = axial.coords(aRef)
		return { q: qs + q, r: rs + r }
	}
}

export class PuzzleLand<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends LandBase<Terrain, Tile> {
	tileSector(aRef: AxialRef) {
		// TODO - check if it's even necessary
		const sector = this.sector(0)
		const hexIndex = axial.index(aRef)
		if (hexIndex > sector.nbrTiles) {
			//debugger
			return { sector, hexIndex: 0 }
		}
		return { sector, hexIndex }
	}
	private sectors: Record<string, Sector<Tile>> = {}

	sector(aRef: AxialRef): Sector<Tile> {
		const key = axial.key(aRef)
		if (!this.sectors[key]) {
			const sectorCenter = sector2tile(aRef)
			const seed = subSeed(this.seed, 'key', axial.index(aRef))
			const sector = new PuzzleSector(
				this,
				this.procedural.listTiles(this, {
					gen: LCG(seed),
					center: axial.linear([this.procedural.radius - 1, sectorCenter]),
				}),
				seed,
				axial.coords(aRef)
			)
			this.sectors[key] = sector
			sector.group.position.copy({
				z: 0,
				...cartesian(sectorCenter, this.landscape.tileSize * (this.procedural.radius - 1)),
			})
			this.addedSector(sector)
		}
		return this.sectors[key]
	}
}
