import { Group, type PerspectiveCamera, type Vector2Like, type Vector3Like } from 'three'
import {
	assert,
	type Axial,
	type AxialCoord,
	type AxialDirection,
	type AxialKey,
	AxialKeyMap,
	type AxialRef,
	AxialSet,
	type Eventful,
	axial,
	cartesian,
	debugInformation,
	fromCartesian,
	hexTiles,
} from '~/utils'
import { logPerformances, resetPerformances } from '~/utils/decorators'
import { Sector } from './sector'

export interface TileBase {
	position: Vector3Like
	// Number of sectors it has been generated in (find an alternative solution, many "1" to store)
	sectors: Sector<any>[]
}

export type TileUpdater<Tile extends TileBase> = (
	updaters: Sector<Tile>[],
	aRef: AxialRef,
	modifications?: Partial<Tile>
) => void

export type RenderedEvent<Tile extends TileBase> = {
	invalidatedRender: (part: LandPart<Tile>, sector: Sector<Tile>) => void
}

/**
 * Used to calculate the time it takes to walk between two tiles
 */
export type WalkTimeSpecification<Tile extends TileBase> = {
	/**
	 * Starting tile
	 */
	from: Tile
	/**
	 * Destination tile
	 */
	to: Tile
	/**
	 * The tile the calculation occurs on (`from` or `to)
	 */
	on: Tile
	direction: AxialDirection
}

export interface LandPart<Tile extends TileBase, GenerationInfo = unknown>
	extends Eventful<RenderedEvent<Tile>> {
	/**
	 * Refine tile information
	 * @param tile
	 * @param coord
	 */
	refineTile?(tile: TileBase, coord: Axial, generationInfo: GenerationInfo): undefined | Tile
	/**
	 * Add Object3D to sector with `sector.add`
	 * @param sector
	 */
	renderSector?(sector: Sector<Tile>): void

	beginGeneration?(): GenerationInfo
	/**
	 *
	 * @param generationInfo Allows this part to spread generative modifications across multiple sectors
	 * @param updateTile Function to call when a tile is modified
	 */
	spreadGeneration?(updateTile: TileUpdater<Tile>, generationInfo: GenerationInfo): void

	walkTimeMultiplier?(movement: WalkTimeSpecification<Tile>): number | undefined
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function cameraVision(camera: PerspectiveCamera): number {
	return camera.far / Math.cos((camera.fov * Math.PI) / 360)
}

function* viewedSectors(centerCoord: AxialCoord, camera: PerspectiveCamera, size: number) {
	const center = axial.round(centerCoord)
	const centerCartesian = cartesian(center, size)
	// Estimate the maximum axial distance. Since a hexagon's circumradius is sqrt(3) * side length,
	// we use D / (sqrt(3) * size) as an upper bound for axial distance check.
	const vision = cameraVision(camera)
	const maxAxialDistance = Math.ceil(vision / size + 0.5)
	// Check all hexagons within this range
	for (const { q, r } of axial.enum(maxAxialDistance)) {
		const currentHex = { q: center.q + q, r: center.r + r }
		const currentCartesian = cartesian(currentHex, size)

		// Check if the Cartesian distance is within D
		if (distance(centerCartesian, currentCartesian) <= vision) {
			yield currentHex
		}
	}
}

/**
 * Represents the position of a point in a tile
 */
export interface PositionInTile {
	/** Side [0..6[ */
	s: number
	/** 2D coordinate in side triangle */
	u: number
	/** 2D coordinate in side triangle */
	v: number
}

function scaleAxial({ q, r }: AxialCoord, scale: number) {
	return {
		q: (q + 2 * r) * scale,
		r: (q - r) * scale,
	}
}

export class Land<Tile extends TileBase = TileBase> {
	public readonly tiles = new AxialKeyMap<Tile>()
	private readonly parts: LandPart<Tile>[] = []
	public readonly group = new Group()
	private readonly sectors = new AxialKeyMap<Sector<Tile>>()
	public readonly sectorRadius: number
	public readonly sectorTiles: number

	constructor(
		public readonly sectorScale: number,
		public readonly tileSize: number
	) {
		// Sectors share their border, so sectors of 1 tile cannot tile a world
		assert(sectorScale > 0, 'sectorScale must be strictly > 0')
		this.sectorRadius = 1 << sectorScale
		this.sectorTiles = hexTiles(this.sectorRadius)
	}

	sector2tile(aRef: AxialRef) {
		return scaleAxial(axial.coord(aRef), this.sectorRadius - 1)
	}
	tile2sector(aRef: AxialRef) {
		return axial.round(scaleAxial(axial.coord(aRef), 1 / (3 * (this.sectorRadius - 1))))
	}

	createSectors(added: AxialSet, generationInfos: Map<LandPart<Tile>, any>) {
		const tileRefiners = this.parts.filter((part) => part.refineTile)
		for (const toSee of added) {
			const center = this.sector2tile(toSee)
			const sectorTiles = axial.enum(this.sectorRadius - 1).map((lclCoord): [AxialKey, Tile] => {
				const point = axial.coordAccess(axial.linear(center, lclCoord))
				let completeTile = this.tiles.get(point.key)
				if (completeTile) return [point.key, completeTile]
				let tile: TileBase = {
					position: { ...cartesian(point, this.tileSize), z: 0 },
					sectors: [],
				}
				for (const part of tileRefiners)
					tile = part.refineTile!(tile, point, generationInfos.get(part)) ?? tile
				completeTile = tile as Tile
				this.tiles.set(point.key, completeTile)
				return [point.key, completeTile]
			})
			const st = Array.from(sectorTiles)
			const sector = new Sector(this, center, new AxialKeyMap(st))
			this.sectors.set(toSee, sector)
			this.sectorsToRender.add(sector)
		}
	}

	spreadGeneration(generationInfos: Map<LandPart<Tile>, any>) {
		for (const part of this.parts)
			if (part.spreadGeneration)
				part.spreadGeneration(
					(sectors, aRef, modifications) => this.tileUpdater(sectors, aRef, modifications),
					generationInfos.get(part)
				)
	}

	renderSectors() {
		const sectorRenderers = this.parts.filter((part) => part.renderSector)
		for (const sector of this.sectorsToRender) {
			if (!sector.invalidParts) {
				if (sector.group) this.group.remove(sector.group)
				sector.group = new Group()
			}
			for (const part of sector.invalidParts ?? sectorRenderers) part.renderSector!(sector)
			sector.invalidParts = new Set()
			this.group.add(sector.group!)
		}
		this.sectorsToRender.clear()
	}

	/**
	 *
	 * @param removed List of candidates for removal
	 * @param cameras Cameras to check distance with
	 * @param marginBufferSize Distance of removal ration (2 = let the sectors twice the visible distance existing)
	 */
	pruneSectors(removed: AxialSet, cameras: PerspectiveCamera[], marginBufferSize: number) {
		for (const key of removed) {
			const deletedSector = this.sectors.get(key)!
			const centerCartesian = cartesian(deletedSector.center, this.tileSize)
			let seen = false
			for (const camera of cameras)
				if (distance(centerCartesian, camera.position) < cameraVision(camera) * marginBufferSize) {
					seen = true
					break
				}
			if (seen) continue
			assert(deletedSector.group, 'Removed group should be generated')
			this.group.remove(deletedSector.group)
			deletedSector.freeTiles()
			this.sectors.delete(key)
			this.sectorsToRender.delete(deletedSector)
		}
	}

	sectorsToRender = new Set<Sector<Tile>>()
	updateViews(cameras: PerspectiveCamera[]) {
		// At first, plan to remove all sectors
		const removed = new AxialSet(this.sectors.keys())
		const generationInfos = new Map<LandPart<Tile>, any>()
		resetPerformances()
		const added = new AxialSet()
		for (const camera of cameras)
			for (const toSee of viewedSectors(
				this.tile2sector(fromCartesian(camera.position, this.tileSize)),
				camera,
				this.tileSize * this.sectorRadius
			)) {
				// If we cannot cancel the deletion of a sector, it means we need to add it
				removed.delete(toSee)
				if (!this.sectors.has(toSee)) added.add(toSee)
			}
		if (added.size > 0) {
			for (const part of this.parts)
				if (part.beginGeneration) generationInfos.set(part, part.beginGeneration())
			this.createSectors(added, generationInfos)
			this.spreadGeneration(generationInfos)
		}
		this.pruneSectors(removed, cameras, 1.2)
		debugInformation.set('sectors', this.sectors.size)
		debugInformation.set('tiles', this.tiles.size)
		logPerformances()
	}

	temporaryTiles = new AxialKeyMap<Tile>()
	generateOneTile(aRef: AxialRef) {
		const point = axial.access(aRef)
		const generationInfos = new Map<LandPart<Tile>, any>()
		for (const part of this.parts)
			if (part.beginGeneration) generationInfos.set(part, part.beginGeneration())
		let tile: TileBase = {
			position: { ...cartesian(point, this.tileSize), z: 0 },
			sectors: [],
		}
		for (const part of this.parts)
			if (part.refineTile) tile = part.refineTile(tile, point, generationInfos.get(part)) ?? tile
		const completeTile = tile as Tile
		this.tiles.set(point.key, completeTile)
		this.temporaryTiles.set(point.key, completeTile)
		for (const part of this.parts)
			if (part.spreadGeneration)
				part.spreadGeneration((sectors, aRef, modifications) => {
					const tile = this.tileUpdater(sectors, aRef, modifications)
					if (!tile.sectors.length) this.temporaryTiles.set(aRef, tile)
				}, generationInfos.get(part))
		return completeTile
	}

	tileUpdater(sectors: Sector<Tile>[], aRef: AxialRef, modifications?: Partial<Tile>) {
		const tile = this.tile(aRef)
		if (modifications) Object.assign(tile, modifications)
		for (const sector of sectors)
			if (!tile.sectors.includes(sector)) {
				tile.sectors.push(sector)
				sector.attachedTiles.add(aRef)
			}
		for (const sector of tile.sectors) {
			this.sectorsToRender.add(sector as Sector<Tile>)
			sector.invalidParts = undefined
		}
		return tile
	}
	addPart(...parts: LandPart<Tile>[]) {
		this.parts.push(...parts)
		for (const part of parts)
			part.on('invalidatedRender', (part: LandPart<Tile>, sector: Sector<Tile>) => {
				sector.invalidate(part)
				this.sectorsToRender.add(sector)
			})
	}

	progress(dt: number) {
		this.renderSectors()
		for (const [key, tile] of this.temporaryTiles) if (!tile.sectors.length) this.tiles.delete(key)
		this.temporaryTiles.clear()
	}
	// #region Tile access

	tile(aRef: AxialRef): Tile {
		const renderedTile = this.tiles.get(aRef)
		if (renderedTile) return renderedTile
		return this.generateOneTile(aRef)
	}

	tileAt(vec2: Vector2Like) {
		return fromCartesian(vec2, this.tileSize)
	}

	// #endregion

	/**
	 * Calculate the half-way cost between a tile center and its border
	 * @param from From which tile we start(ed)
	 * @param to Which tile we end on/head to
	 * @param on `from` or `to` depending
	 */
	walkTileCost(movement: WalkTimeSpecification<Tile>) {
		let rv = 1
		for (const part of this.parts)
			if (part.walkTimeMultiplier) {
				rv *= part.walkTimeMultiplier(movement) ?? 1
				if (Number.isNaN(rv)) return Number.NaN
			}
		return rv
	}

	halfTileCost(
		from: Axial,
		to: Axial,
		direction: 'enter' | 'exit',
		tiles?: { from: Tile; to: Tile }
	) {
		tiles ??= {
			from: this.tile(from),
			to: this.tile(to),
		}
		return this.walkTileCost({
			from: tiles.from,
			to: tiles.to,
			on: direction === 'enter' ? tiles.to : tiles.from,
			direction:
				direction === 'enter'
					? (axial.neighborIndex(from, to) ?? null)
					: (axial.neighborIndex(to, from) ?? null),
		})
	}

	static walkCost<Tile extends TileBase>(land: Land<Tile>) {
		return (from: Axial, to: Axial) => {
			const tiles = {
				from: land.tile(from),
				to: land.tile(to),
			}
			return (
				land.halfTileCost(from, to, 'exit', tiles) + land.halfTileCost(from, to, 'enter', tiles)
			)
		}
	}
}
