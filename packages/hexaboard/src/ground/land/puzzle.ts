import { Group } from 'three'
import { LCG, subSeed } from '~/utils/numbers'
import { type Axial, type AxialRef, axial, cartesian, hexTiles } from '../../utils/axial'
import type { LandscapeBase } from '../landscape'
import type { ProceduralBase } from '../procedural'
import type { TileBase } from '../sector'
import Sector from '../sector'
import type { TerrainBase, TerrainDefinition } from '../terrain'
import { LandBase } from './land'

function sector2tile(aRef: AxialRef, radius = 1) {
	const { q, r } = axial.coords(aRef)
	return axial.linear([q * radius, { q: 1, r: 1 }], [r * radius, { q: 2, r: -1 }])
}

export class PuzzleSector<Tile extends TileBase = TileBase> extends Sector<Tile> {
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
	get nbrTiles(): number {
		const radius = this.land.procedural.radius - 1
		return hexTiles(radius) + 2 * radius
	}
	tileSeed(aRef: AxialRef) {
		const { q: qs, r: rs } = sector2tile(this.center)
		const { q, r } = axial.coords(aRef)
		return subSeed('puzzle-tile', qs + q, rs + r)
	}
	worldTile(aRef: AxialRef) {
		const { q: qs, r: rs } = sector2tile(this.center)
		const { q, r } = axial.coords(aRef)
		return { q: qs + q, r: rs + r }
	}
}

export class PuzzleLand<
	Tile extends TileBase = TileBase,
	Terrain extends TerrainBase = TerrainBase,
> extends LandBase<Tile, Terrain> {
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
	readonly group = new Group()
	constructor(
		public readonly terrains: TerrainDefinition<Terrain>,
		public readonly procedural: ProceduralBase<Tile>,
		public readonly landscape: LandscapeBase,
		public readonly seed: number
	) {
		super(terrains, procedural, landscape)
	}

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
			sector.landscape(this.landscape.createMesh(sector))
			sector.group.position.copy({
				z: 0,
				...cartesian(sectorCenter, this.landscape.tileSize * (this.procedural.radius - 1)),
			})
			this.group.add(sector.group)
		}
		return this.sectors[key]
	}
}
