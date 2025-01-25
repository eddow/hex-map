import type { Vector3 } from 'three'
import type { LandBase, TerrainBase } from '~/sectored'
import type Sector from '~/sectored/sector'
import type { TileBase } from '~/sectored/sector'
import { type Axial, axial } from '~/utils'
import { cache, cached } from '~/utils/cached'
import { MouseHandle } from '~/utils/mouseControl'
import type { Game } from '.'

export abstract class GameMouseHandle<Tile extends TileBase = TileBase> extends MouseHandle {
	constructor(public readonly game: Game) {
		super()
	}
}
export class SectorNotGeneratedError extends Error {
	constructor(public readonly axial: Axial) {
		super('sector not generated')
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
	/**
	 * The sector the tile is in
	 */
	@cached<Sector<Tile>>('land', 'axial')
	get sector(): Sector<Tile> {
		const sector = this.land.sectorAt(this.axial)
		if (!sector) throw new SectorNotGeneratedError(this.axial)
		return sector
	}
	/**
	 * The index of the tile in the sector
	 */
	@cached<number>('land', 'axial')
	get hexIndex(): number {
		return axial.index(axial.linear(this.axial, [-1, this.sector.center]))
	}
	/**
	 * The axial coordinates of the tile in the world
	 */
	@cached<Axial>('sector', 'hexIndex')
	get axial(): Axial {
		return this.sector.worldTile(this.hexIndex)
	}

	/**
	 * The tile object associated with the spec
	 */
	@cached<Tile>()
	get tile(): Tile {
		return this.sector.tiles[this.hexIndex]
	}
	/**
	 * The center of the tile as (x,y,z) world coordinate
	 */
	@cached<Vector3>()
	get center(): Vector3 {
		return this.sector.tileCenter(this.hexIndex)
	}

	get key(): string {
		return axial.key(this.axial)
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
