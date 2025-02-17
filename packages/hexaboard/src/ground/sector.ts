import { type Node, TransformNode } from '@babylonjs/core'
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
	vector3from,
} from '~/utils'
import type { Land, LandPart, PositionInTile, TileBase } from './land'

export type SectorStatus = 'creating' | 'rendering' | 'existing' | 'rendered' | 'deleted'

export interface SectorDebugUtils {
	create(sector: Sector): void
	log(point: Sector, event: LogEvent): void
	addIn(node: TransformNode, sector: Sector): void
	assertInvariant(invariant: string, key: AxialRef, sectors: AxialKeyMap<any>): void
	assertStatus(key: AxialRef, status: SectorStatus, land: Land<any>): void
}

/*
0- inexistent: land.sectors[key] -> undefined
g - generating: land.generating[key] -> defined
x- cancelled: land.markedForDeletion[key]-> defined
1- generated
*/
const sectors = new WeakMap<Node, Sector>()
const uuids = new WeakMap<Sector, string>()
type LogEvent = Record<string, any>
const logs = new AxialKeyMap<LogEvent[]>()

const debugSectorLeak: true | undefined = true
export const SDU: SectorDebugUtils | undefined = debugSectorLeak && {
	create(sector: Sector<TileBase>) {
		sectors.set(sector.node, sector)
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
	addIn(land: TransformNode, sector: Sector<TileBase>) {
		for (const node of land.getChildren()) {
			if (sectors.get(node)?.center === sector.center) {
				const log = logs.get(sector.point)
				console.dir(log)
				throw new Error("Sector's position already added")
			}
		}
	},
	assertInvariant(invariant: string, key: AxialRef, sectors: AxialKeyMap<Sector>): void {
		type InvariantCheck = 'A' | 'B' | 'C'
		const sector = sectors.get(key)
		const actualState = {
			A: !!sector,
			B: !!sector?.promise,
			C: !!sector?.markedForDeletion,
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
	status: SectorStatus
	markedForDeletion?: true
	promise?: Promise<void>
	public readonly node: TransformNode
	private parts = new Map<LandPart<Tile>, TransformNode>()
	public invalidParts?: Set<LandPart<Tile>>
	public readonly attachedTiles = new AxialSet()
	private allocatedTiles?: AxialKeyMap<Tile>
	constructor(
		public readonly point: Axial,
		public readonly land: Land<Tile>,
		public readonly center: AxialCoord
	) {
		this.node = new TransformNode(`Sector #${point.key}`, land.gameView.scene, true)
		this.status = 'creating'
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

	cartesian(point: Axial) {
		return { ...cartesian(point, this.land.tileSize), y: this.tile(point)?.position?.y ?? 0 }
	}
	setPartNode(part: LandPart<Tile>, node: TransformNode) {
		const oldNode = this.parts.get(part)
		if (oldNode) {
			this.node.removeChild(oldNode)
			oldNode.dispose()
		}
		this.node.addChild(node)
		this.parts.set(part, node)
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
		const pos = this.position(aRef)

		const next1dir = this.position(next1)
			.subtract(pos)
			.scale(u / 2)

		const next2dir = this.position(next2)
			.subtract(pos)
			.scale(v / 2)

		return pos.addInPlace(next1dir).addInPlace(next2dir)
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
		// If not yet allocated (deleted before creation)
		if (this.allocatedTiles) removeTiles(this.allocatedTiles.keys())
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

	global(point: AxialRef) {
		return axial.coordAccess(axial.linear(this.center, axial.access(point)))
	}

	position(aRef: AxialRef) {
		const tile = this.tile(axial.access(aRef))
		return vector3from(tile.position)
	}

	get logs() {
		return logs.get(this.point)
	}
}
