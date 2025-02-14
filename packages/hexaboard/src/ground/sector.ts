import { Group, type Object3D, Vector3 } from 'three'
import {
	assert,
	type Axial,
	type AxialCoord,
	AxialKeyMap,
	type AxialRef,
	AxialSet,
	axial,
	cartesian,
	hexSides,
} from '~/utils'
import { cached } from '~/utils/decorators'
import type { Land, LandPart, PositionInTile, TileBase } from './land'

export type SectorStatus = 'creating' | 'rendering' | 'existing'
export interface AsyncSector<Tile extends TileBase> extends Sector<Tile> {
	status: SectorStatus
	promise?: Promise<void>
}

export interface SectorDebugUtils {
	create(sector: Sector): void
	log(point: Sector, event: LogEvent): void
	addIn(group: Group, sector: Sector): void
	assertInvariant(
		invariant: string,
		key: AxialRef,
		sectors: AxialKeyMap<any>,
		renderingSectors: AxialKeyMap<any>,
		markedForDeletion: AxialSet
	): void
	assertStatus(key: AxialRef, status: SectorStatus, land: Land<any>): void
}

/*
0- inexistent: land.sectors[key] -> undefined
g - generating: land.generating[key] -> defined
x- cancelled: land.markedForDeletion[key]-> defined
1- generated
*/
const sectors = new WeakMap<Object3D, Sector>()
const uuids = new WeakMap<Sector, string>()
type LogEvent = Record<string, any>
const logs = new AxialKeyMap<LogEvent[]>()

const debugSectorLeak: true | undefined = true
export const SDU: SectorDebugUtils | undefined = debugSectorLeak && {
	create(sector: Sector<TileBase>) {
		sectors.set(sector.group, sector)
		uuids.set(sector, crypto.randomUUID())
		SDU?.log(sector, { type: 'create' })
	},
	log(sector: Sector, event: LogEvent) {
		event = { sector: uuids.get(sector), ...event }
		const point = sector.point
		let log = logs.get(point)
		if (!log) {
			log = []
			logs.set(point, log)
		}
		log.push({ ...event, stack: new Error().stack })
	},
	addIn(group: Group, sector: Sector<TileBase>) {
		for (const o3d of group.children) {
			if (sectors.get(o3d)?.center === sector.center) {
				const log = logs.get(sector.point)
				console.dir(log)
				throw new Error("Sector's position already added")
			}
		}
	},
	assertInvariant(
		invariant: string,
		key: AxialRef,
		sectors: AxialKeyMap<any>,
		renderingSectors: AxialKeyMap<any>,
		markedForDeletion: AxialSet
	): void {
		type InvariantCheck = 'A' | 'B' | 'C'
		const actualState = {
			A: sectors.has(key),
			B: renderingSectors.has(key),
			C: markedForDeletion.has(key),
		}
		const expectedState = {
			0: { A: false, B: false, C: false },
			g: { A: true, B: true, C: false },
			x: { A: true, B: true, C: true },
			1: { A: true, B: false, C: false },
		}[`${invariant}`]
		assert(expectedState, `Invariant ${invariant} not defined`)
		for (const [key, value] of Object.entries(actualState))
			if (value !== expectedState[key as InvariantCheck])
				throw new Error(
					`Invariant ${invariant} violated: ${key} ${value} !== ${expectedState[key as InvariantCheck]}`
				)
	},
	assertStatus(key: AxialRef, status: SectorStatus, land: Land<any>) {
		const sector = land.sectors.get(key)
		if (!sector) throw new Error('Sector not found')
		if (sector.status !== status) throw new Error(`Sector status ${sector.status} !== ${status}`)
	},
}

export class Sector<Tile extends TileBase = TileBase> {
	public readonly group = new Group()
	private parts = new Map<LandPart<Tile>, Object3D>()
	public invalidParts?: Set<LandPart<Tile>>
	public readonly attachedTiles = new AxialSet()
	private allocatedTiles?: AxialKeyMap<Tile>
	constructor(
		public readonly land: Land<Tile>,
		public readonly center: AxialCoord
	) {
		SDU?.create(this)
	}

	get tiles() {
		if (!this.allocatedTiles) throw new Error('Sector tiles not allocated')
		return this.allocatedTiles
	}
	set tiles(value: AxialKeyMap<Tile>) {
		if (this.allocatedTiles) throw new Error('Sector tiles already allocated')
		this.allocatedTiles = value
		for (const [_, tile] of this.tiles) tile.sectors.push(this)
	}

	@cached()
	get point() {
		return axial.coordAccess(this.land.tile2sector(this.center)).key
	}
	cartesian(point: Axial) {
		return { ...cartesian(point, this.land.tileSize), z: this.tile(point)?.position?.z ?? 0 }
	}
	setPartO3d(part: LandPart<Tile>, o3d: Object3D) {
		const oldO3d = this.parts.get(part)
		if (oldO3d) this.group.remove(oldO3d)
		this.group.add(o3d)
		this.parts.set(part, o3d)
	}
	invalidate(part: LandPart<Tile>) {
		SDU?.log(this, { type: 'invalidate', part: part.constructor.name })
		this.invalidParts?.add(part)
	}
	/**
	 * Retrieves a point (xyz) inside a rendered tile
	 * In case of border tiles, positions involving a tile outside of the sector return `null`
	 * Reference: tile
	 * @returns
	 */
	inTile(aRef: AxialRef, { s, u, v }: PositionInTile) {
		const point = axial.access(aRef)
		const next1 = axial.linear(point, hexSides[s])
		const next2 = axial.linear(point, hexSides[(s + 1) % 6])
		if (!this.tiles.has(next1) || !this.tiles.has(next2)) return null
		const pos = new Vector3().copy(this.tiles.get(aRef)!.position)
		const next1dir = new Vector3()
			.copy(this.tiles.get(next1)!.position)
			.sub(pos)
			.multiplyScalar(u / 2)
		const next2dir = new Vector3()
			.copy(this.tiles.get(next2)!.position)
			.sub(pos)
			.multiplyScalar(v / 2)
		return pos.add(next1dir).add(next2dir)
	}
	freeTiles() {
		SDU?.log(this, { type: 'freeTiles' })
		const { tiles } = this.land
		const removeTiles = (bunch: Iterable<AxialRef>) => {
			for (const point of bunch) {
				const tile = tiles.get(point)
				if (!tile) continue
				tile.sectors = tile.sectors.filter((sector) => sector !== this)
				if (tile.sectors.length === 0) tiles.delete(point)
			}
		}
		removeTiles(this.tiles.keys())
		removeTiles(this.attachedTiles)
	}
	tile(point: Axial) {
		let rv = this.tiles.get(point)
		if (!rv) {
			rv = this.land.tile(point)
			this.tiles.set(point, rv)
		}
		return rv
	}

	get logs() {
		return logs.get(this.point)
	}
}
