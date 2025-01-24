import type { Vector3 } from 'three'
import type { LandBase, TerrainBase } from '~/ground'
import type Sector from '~/ground/sector'
import type { TileBase } from '~/ground/sector'
import { type Axial, axial } from '~/utils'
import { cache, cached } from '~/utils/cached'
import { MouseHandle } from '~/utils/mouseControl'
import type { Game } from '.'

export abstract class GameMouseHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(public readonly game: Game) {
		super()
	}
}

export class TileSpec<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> {
	constructor(
		land?: LandBase<Terrain, Tile>,
		axial?: Axial,
		sector?: Sector<Tile> | null,
		hexIndex?: number | null,
		tile?: Tile
	) {
		if (land !== undefined) cache(this, 'land', land)
		if (sector !== undefined) cache(this, 'sector', sector)
		if (hexIndex !== undefined) cache(this, 'hexIndex', hexIndex)
		if (axial !== undefined) cache(this, 'axial', axial)
		if (tile !== undefined) cache(this, 'tile', tile)
	}

	@cached<LandBase<Terrain, Tile>>('sector')
	get land(): LandBase<Terrain, Tile> {
		return this.sector.land as LandBase<Terrain, Tile>
	}
	@cached<Sector<Tile>>('land', 'axial')
	get sector(): Sector<Tile> {
		const sector = this.land.sectorAt(this.axial)
		if (!sector) throw new Error('Sector not generated')
		return sector
	}
	@cached<number>('land', 'axial')
	get hexIndex(): number {
		const sector = this.sector
		return axial.index(axial.linear(this.axial, [-1, sector.center]))
	}
	@cached<Axial>('sector', 'hexIndex')
	get axial(): Axial {
		return this.sector.worldTile(this.hexIndex)
	}

	@cached<Tile>()
	get tile(): Tile {
		const sector = this.land.sectorAt(this.axial)
		if (!sector) throw new Error('Sector not generated')
		return this.sector.tiles[this.hexIndex]
	}
	@cached<Vector3>()
	get center(): Vector3 {
		return this.sector.tileCenter(this.hexIndex)
	}
}

export class TileHandle<Tile extends TileBase = TileBase> extends GameMouseHandle<Tile> {
	constructor(
		game: Game,
		public readonly spec: TileSpec<TerrainBase, Tile>
	) {
		super(game)
	}
	equals(other: MouseHandle) {
		return (
			other instanceof TileHandle &&
			other.spec.sector === this.spec.sector &&
			other.spec.hexIndex === this.spec.hexIndex
		)
	}
}
