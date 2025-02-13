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
} from '~/utils'
import { SDU, Sector } from './sector'

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

export type RenderedEvents<Tile extends TileBase> = {
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

export interface LandPart<Tile extends TileBase> extends Eventful<RenderedEvents<Tile>> {
	/**
	 * Refine tile information
	 * @param tile
	 * @param coord
	 */
	refineTile?(tile: TileBase, coord: Axial): undefined | Tile
	/**
	 * Add Object3D to sector with `sector.add`
	 * @param sector
	 */
	renderSector?(sector: Sector<Tile>): Promise<void>
	/**
	 * @param updateTile Function to call when a tile is modified
	 */
	spreadGeneration?(updateTile: TileUpdater<Tile>): void

	walkTimeMultiplier?(movement: WalkTimeSpecification<Tile>): number | undefined
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function cameraVision(camera: PerspectiveCamera): number {
	//DEBUG VALUE
	//return camera.far / Math.cos((camera.fov * Math.PI) / 360)
	return 300
}

function* viewedSectors(
	centerCoord: AxialCoord,
	camera: PerspectiveCamera,
	size: number,
	dist0: number
) {
	const center = axial.round(centerCoord)
	const centerCartesian = cartesian(center, size)
	// Estimate the maximum axial distance. Since a hexagon's circumradius is sqrt(3) * side length,
	// we use D / (sqrt(3) * size) as an upper bound for axial distance check.
	const vision = cameraVision(camera) + dist0
	const maxAxialDistance = Math.ceil(vision / size)
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
	private readonly markedForDeletion = new AxialSet()
	private readonly sectors = new AxialKeyMap<Sector<Tile>>()
	public readonly sectorRadius: number
	/**
	 * Radius of a sector in "unit"
	 */
	public readonly sectorDist0: number
	constructor(
		public readonly sectorScale: number,
		public readonly tileSize: number,
		/**
		 * Radius in sectors
		 */
		public readonly landRadius: number = Number.POSITIVE_INFINITY
	) {
		// Sectors share their border, so sectors of 1 tile cannot tile a world
		assert(sectorScale >= 0, 'sectorScale must be positive')
		this.sectorRadius = 1 << sectorScale
		this.sectorDist0 = this.sectorRadius * Math.sqrt(3) * tileSize
	}

	sector2tile(coord: AxialCoord) {
		return scaleAxial(coord, this.sectorRadius)
	}
	tile2sector(coord: AxialCoord) {
		return axial.round(scaleAxial(coord, 1 / (3 * this.sectorRadius)))
	}

	private needGenerationSpread = false
	spreadGeneration() {
		if (this.needGenerationSpread)
			for (const part of this.parts)
				if (part.spreadGeneration)
					part.spreadGeneration((sectors, aRef, modifications) =>
						this.tileUpdater(sectors, aRef, modifications)
					)
	}

	renderingSectors = new AxialKeyMap<{ sector: Sector<Tile>; rendering: Promise<void> }>()
	markToRender(sector: Sector<Tile>) {
		SDU?.log(sector, { type: 'markToRender' }) // SectorInvariant: 1->g
		// TODO: Might have problem when rendering a part and need to render whole or vice&versa
		// NOTE: occurs for example when "resourcefulTerrain" changes (road/tree/...)
		setTimeout(() => {
			if (
				!this.renderingSectors.has(sector.point) &&
				!this.markedForDeletion.has(sector.point) &&
				this.sectors.get(sector.point) === sector
			) {
				SDU?.assertInvariant(
					'1',
					sector.point,
					this.sectors,
					this.renderingSectors,
					this.markedForDeletion
				)
				SDU?.log(sector, { type: 'begin render' })
				this.renderingSectors.set(sector.point, {
					sector,
					rendering: this.renderSector(sector).then(() => {
						this.renderingSectors.delete(sector.point) // g->1
						SDU?.log(sector, { type: 'done render' })
					}),
				})
				SDU?.assertInvariant(
					'g',
					sector.point,
					this.sectors,
					this.renderingSectors,
					this.markedForDeletion
				)
			}
		})
	}

	async renderSector(sector: Sector<Tile>) {
		const sectorRenderers = this.parts.filter((part) => part.renderSector)
		// todo await setTimeout <- spreadGeneration
		this.spreadGeneration()
		const { invalidParts } = sector
		sector.invalidParts = new Set()
		// Must be sequential as there is inter-dependency (cf. terrainHeight)
		// TODO: Landscaper must be concurrently
		for (const part of invalidParts ?? sectorRenderers) await part.renderSector!(sector)
	}

	createSectors(added: Iterable<AxialCoord>) {
		const tileRefiners = this.parts.filter((part) => part.refineTile)
		for (const toSee of added) {
			const center = this.sector2tile(toSee)
			const sectorTiles = axial.enum(this.sectorRadius).map((lclCoord): [AxialKey, Tile] => {
				const point = axial.coordAccess(axial.linear(center, lclCoord))
				let completeTile = this.tiles.get(point.key)
				if (completeTile) return [point.key, completeTile]
				let tile: TileBase = {
					position: { ...cartesian(point, this.tileSize), z: 0 },
					sectors: [],
				}
				for (const part of tileRefiners) tile = part.refineTile!(tile, point) ?? tile
				completeTile = tile as Tile
				this.tiles.set(point.key, completeTile)
				return [point.key, completeTile]
			})
			const sector = new Sector(this, center, new AxialKeyMap(sectorTiles))
			this.needGenerationSpread = true
			SDU?.log(sector, { type: 'add-new' })
			SDU?.addIn(this.group, sector)
			SDU?.assertInvariant('0', toSee, this.sectors, this.renderingSectors, this.markedForDeletion)
			this.sectors.set(toSee, sector) // SectorInvariant: 0->1
			this.group.add(sector.group!)
			SDU?.assertInvariant('1', toSee, this.sectors, this.renderingSectors, this.markedForDeletion)
			this.markToRender(sector)
		}
	}

	/**
	 *
	 * @param removed List of candidates for removal
	 * @param cameras Cameras to check distance with
	 * @param marginBufferSize Distance of removal ration (2 = let the sectors twice the visible distance existing)
	 */
	pruneSectors(removed: AxialSet, cameras: PerspectiveCamera[], marginBufferSize: number) {
		for (const key of removed)
			if (!this.markedForDeletion.has(key)) {
				const deletedSector = this.sectors.get(key)!
				const centerCartesian = cartesian(deletedSector.center, this.tileSize)
				let seen = false
				for (const camera of cameras)
					if (
						distance(centerCartesian, camera.position) <
						cameraVision(camera) * marginBufferSize + this.sectorDist0
					) {
						seen = true
						break
					}
				if (seen) continue
				SDU?.log(deletedSector, { type: 'remove' })
				const rendering = this.renderingSectors.get(key)?.rendering
				const freeResources = ((deletedSector: Sector<Tile>) => () => {
					// SectorInvariant: x->0
					if (!this.markedForDeletion.delete(key)) return
					this.sectors.delete(key)
					SDU?.log(deletedSector, { type: 'group-remove' })
					assert(
						this.group.children.includes(deletedSector.group),
						'Deleted sector group not found'
					)
					this.group.remove(deletedSector.group)
					deletedSector.freeTiles()
					SDU?.assertInvariant(
						'0',
						key,
						this.sectors,
						this.renderingSectors,
						this.markedForDeletion
					)
				})(deletedSector)
				if (rendering) {
					// SectorInvariant: g->x
					SDU?.log(deletedSector, { type: 'cancel render' })
					//this.renderingSectors.delete(key)
					rendering.then(freeResources)
					this.markedForDeletion.add(key)
					SDU?.assertInvariant(
						'x',
						key,
						this.sectors,
						this.renderingSectors,
						this.markedForDeletion
					)
				} else {
					SDU?.assertInvariant(
						'1',
						key,
						this.sectors,
						this.renderingSectors,
						this.markedForDeletion
					)
					this.markedForDeletion.add(key)
					freeResources() // SectorInvariant: 1->0
					SDU?.assertInvariant(
						'0',
						key,
						this.sectors,
						this.renderingSectors,
						this.markedForDeletion
					)
				}
			}
	}
	updateViews(cameras: PerspectiveCamera[]) {
		if (Number.isFinite(this.landRadius)) {
			if (this.sectors.size === 0) this.generateWholeLand()
			return
		}
		// At first, plan to remove all sectors - remove the ones seen afterward
		const removed = new AxialSet(this.sectors.keys())
		const added = new AxialSet()
		for (const camera of cameras)
			for (const toSee of viewedSectors(
				this.tile2sector(fromCartesian(camera.position, this.tileSize)),
				camera,
				this.tileSize * this.sectorRadius,
				this.sectorDist0
			)) {
				removed.delete(toSee)
				if (!this.sectors.has(toSee)) added.add(toSee)
				else this.markedForDeletion.delete(toSee) // x -> g
			}
		if (added.size > 0) this.createSectors(added)
		this.pruneSectors(removed, cameras, 1.2)
		debugInformation.set('sectors', this.sectors.size)
		debugInformation.set('landGroup', this.group.children.length)
		debugInformation.set('tiles', this.tiles.size)
	}

	generateWholeLand() {
		if (!Number.isFinite(this.landRadius)) return
		this.createSectors(axial.enum(this.landRadius))
	}

	temporaryTiles = new AxialKeyMap<Tile>()
	generateOneTile(aRef: AxialRef) {
		// TODO: if (Number.isFinite(this.landRadius)) return null
		const point = axial.access(aRef)
		let tile: TileBase = {
			position: { ...cartesian(point, this.tileSize), z: 0 },
			sectors: [],
		}
		this.needGenerationSpread = true
		for (const part of this.parts) if (part.refineTile) tile = part.refineTile(tile, point) ?? tile
		const completeTile = tile as Tile
		this.tiles.set(point.key, completeTile)
		this.temporaryTiles.set(point.key, completeTile)
		for (const part of this.parts)
			part.spreadGeneration?.((sectors, aRef, modifications) => {
				const tile = this.tileUpdater(sectors, aRef, modifications)
				if (!tile.sectors.length) this.temporaryTiles.set(aRef, tile)
			})
		return completeTile
	}

	/**
	 * Callback given to functions susceptible to update tiles - keep track of sectors who have to be re-rendered, &c
	 * @param sectors
	 * @param aRef
	 * @param modifications
	 * @returns
	 */
	tileUpdater(sectors: Sector<Tile>[], aRef: AxialRef, modifications?: Partial<Tile>) {
		const tile = this.tile(aRef)
		if (modifications) Object.assign(tile, modifications)
		for (const sector of sectors)
			if (!tile.sectors.includes(sector)) {
				tile.sectors.push(sector)
				sector.attachedTiles.add(aRef)
			}
		for (const sector of tile.sectors) {
			sector.invalidParts = undefined
			this.markToRender(sector as Sector<Tile>)
		}
		return tile
	}
	addPart(...parts: LandPart<Tile>[]) {
		this.parts.push(...parts)
		for (const part of parts)
			part.on('invalidatedRender', (part: LandPart<Tile>, sector: Sector<Tile>) => {
				sector.invalidate(part)
				this.markToRender(sector)
			})
	}

	progress(dt: number) {
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
