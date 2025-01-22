import { Vector2, type Vector3 } from 'three'
import { LCG, subSeed } from '~/utils/numbers'
import {
	type Axial,
	type AxialRef,
	axial,
	axialRound,
	cartesian,
	fromCartesian,
	hexTiles,
} from '../../utils/axial'
import type { TileBase } from '../sector'
import Sector from '../sector'
import type { TerrainBase } from '../terrain'
import { LandBase } from './land'

function sector2tile(aRef: AxialRef, radius = 1) {
	const { q, r } = axial.coords(aRef)
	return {
		q: (q + 2 * r) * radius,
		r: (q - r) * radius,
	}
}
function tile2sector(aRef: AxialRef, radius = 1) {
	return axialRound(sector2tile(aRef, 1 / (3 * radius)))
}
export class PuzzleSector<Tile extends TileBase = TileBase> extends Sector<Tile> {
	constructor(
		public readonly land: PuzzleLand,
		tiles: Tile[],
		seed: number,
		public readonly center: Axial
	) {
		super(land, tiles, seed)
	}

	tileGen(aRef: AxialRef) {
		const { q, r } = this.worldTile(aRef)
		return LCG('puzzle-tile', q, r)
	}
	worldTile(aRef: AxialRef) {
		const { q: qs, r: rs } = sector2tile(this.center, this.land.procedural.radius - 1)
		const { q, r } = axial.coords(aRef)
		return { q: qs + q, r: rs + r }
	}
}

const viewDist = 1200

export class PuzzleLand<
	Terrain extends TerrainBase = TerrainBase,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends LandBase<Terrain, Tile> {
	private sectors: Record<string, Sector<Tile>> = {}

	createSector(tiles: Tile[], seed: number, axial: Axial, ...args: any[]) {
		return new PuzzleSector(this, tiles, seed, axial)
	}
	sector(aRef: AxialRef): Sector<Tile> {
		const key = axial.key(aRef)
		if (!this.sectors[key]) {
			const sectorCenter = sector2tile(aRef)
			const seed = subSeed(this.seed, 'key', axial.index(aRef))
			const radius = this.procedural.radius - 1
			const sector = this.createSector(
				this.procedural.listTiles(this, {
					gen: LCG(seed),
					center: axial.linear([radius, sectorCenter]),
				}),
				seed,
				axial.coords(aRef)
			)
			this.sectors[key] = sector
			sector.group.position.copy({
				z: 0,
				...cartesian(sectorCenter, this.landscape.tileSize * radius),
			})
			this.addedSector(sector)
		}
		return this.sectors[key]
	}
	updateViews(cameras: Vector3[]) {
		const radius = this.procedural.radius - 1
		const tileSize = this.landscape.tileSize
		const checked: Record<string, true> = {}
		// Make sure all sectors in a certain radius are visible
		const rings = 2 + Math.round(viewDist / (radius * tileSize * 4 * Math.sqrt(3)))
		for (const camera of cameras) {
			const sector = tile2sector(fromCartesian(camera, tileSize), radius)
			for (let dS = 0; dS < hexTiles(rings); dS++) {
				// Axial coordinates of the sector to check if we should generate it
				const sectorCoords = axial.linear([1, dS], [1, sector])
				checked[axial.key(sectorCoords)] = true
				// If it's not already generated
				if (!this.sectors[axial.key(sectorCoords)]) {
					const sectorVec2 = new Vector2().copy(
						cartesian(sector2tile(sectorCoords, radius), tileSize)
					)
					if (sectorVec2.sub(camera).length() < viewDist + radius * tileSize * 2 * Math.sqrt(3))
						this.sector(sectorCoords)
				}
			}
		}
		// List all the generated sectors and their distances to cameras to perhaps remove them
		for (const key in this.sectors)
			if (!checked[key]) {
				const sectorVec2 = new Vector2().copy(cartesian(sector2tile(key, radius), tileSize))
				let aCameraIsNear = false
				for (const camera of cameras)
					if (sectorVec2.sub(camera).length() < viewDist + radius * tileSize * 3) {
						aCameraIsNear = true
						break
					}
				if (!aCameraIsNear) {
					this.removeSector(this.sectors[key])
					delete this.sectors[key]
				}
			}
	}
}
