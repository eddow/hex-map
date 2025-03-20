import { Group, type PerspectiveCamera, type Vector2Like, type Vector3Like } from 'three'
import {
	type Inferred,
	type Input1D,
	type WebGpGpu,
	mapEntries,
	type vec2,
	vec2f,
	vec3f,
} from 'webgpgpu.ts'
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
import { cached } from '~/utils/decorators'
import gpu from '~/utils/gpu'
import { SDU, Sector } from './sector'

export class SectorNotGeneratedError extends Error {
	constructor(public readonly key: AxialKey) {
		super(`Tile ${key} has not been generated`)
	}
}

// DEBUG VALUE
export const debugHole = false

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

export type TerrainKey = PropertyKey

export interface TerrainBase {
	color: { r: number; g: number; b: number }
	walkTimeMultiplier?: number
}

export interface TerrainTile extends TileBase {
	terrain: TerrainKey
}

export type LandGpGpu = WebGpGpu<
	{
		'threads.x': Inferred
		'threads.y': Inferred
	},
	{ centers: Input1D<vec2> },
	any
>

export interface LandPart<Tile extends TileBase> extends Eventful<RenderedEvents<Tile>> {
	/**
	 * Refine tile information
	 * @param tile
	 * @param coord
	 */
	refineTile?(tile: TileBase, coord: Axial, tilePrecalc: Record<string, any>): undefined | Tile
	/**
	 * Add Object3D to sector with `sector.add`
	 * @param sector
	 */
	renderSector?(sector: Sector<Tile>): Promise<void>

	walkTimeMultiplier?(movement: WalkTimeSpecification<Tile>): number | undefined

	calculus?(wgg: LandGpGpu): LandGpGpu
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function cameraVision(camera: PerspectiveCamera): number {
	return debugHole ? 300 : camera.far / Math.cos((camera.fov * Math.PI) / 360)
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
		//*
		q: (q + 2 * r) * scale,
		r: (q - r) * scale /*/,
		q: q * scale,
		r: r * scale, //*/,
	}
}

export class Land<Tile extends TileBase = TileBase> {
	public readonly tiles = new AxialKeyMap<Tile>()
	private readonly parts: LandPart<Tile>[] = []
	public readonly group = new Group()
	public readonly sectors = new AxialKeyMap<Sector<Tile>>()
	public readonly sectorRadius: number
	/**
	 * Radius of a sector in "unit"
	 */
	public readonly sectorDist0: number
	private readonly precalcTiles: AxialCoord[]
	/**
	 * WebGpGpu Promise
	 */
	private landKernel = gpu((wgg) => {
		let rv: LandGpGpu = wgg
			.import('axial')
			.common({
				localCoords: vec2f.array('threads.x').value(this.precalcTiles.map(({ q, r }) => [q, r])),
			})
			.input({ centers: vec2f.array('threads.y') })
			.output({ positions: vec3f.array('threads.y', 'threads.x') })
			.code(/*wgsl*/ `
override seed: f32 = 0.0;
@init
	let zero = (tileSize+seed)*0.0;	// Avoid optimizing out overrides
	let worldCoords = localCoords[thread.x]+centers[thread.y];
	let position = vec3f(cartesian(worldCoords), zero);
@finalize
	positions[dot(thread.yx, positionsStride)] = position;
		`)
		for (const part of this.parts) if (part.calculus) rv = part.calculus(rv)
		return rv.kernel('', { seed: this.seed, tileSize: this.tileSize })
	})
	constructor(
		public readonly seed: number,
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
		this.precalcTiles = Array.from(axial.enum(this.sectorRadius))
		this.sectorDist0 = this.sectorRadius * Math.sqrt(3) * tileSize
	}

	sector2tile(coord: AxialCoord) {
		return scaleAxial(coord, this.sectorRadius)
	}
	tile2sector(coord: AxialCoord) {
		return axial.round(scaleAxial(coord, 1 / (3 * this.sectorRadius)))
	}

	propagateDebugInformation() {
		debugInformation.set('landGroup', this.group.children.length)
		debugInformation.set('tiles', this.tiles.size)
		debugInformation.set('sectors', this.sectors.size)
	}

	markToRender(sector: Sector<Tile>) {
		SDU?.log(sector, { type: 'markToRender' }) // SectorInvariant: 1->g
		// TODO: Might have problem when rendering a part and need to render whole or vice&versa
		// NOTE: occurs for example when "resourcefulTerrain" changes (road/tree/...)
		//setTimeout(() => {
		if (
			sector.status !== 'rendering' &&
			!sector.markedForDeletion &&
			this.sectors.get(sector.point) === sector
		) {
			SDU?.assertInvariant('1', sector.point, this.sectors)
			SDU?.log(sector, { type: 'begin render' })
			sector.status = 'rendering'
			sector.promise = this.renderSector(sector).then(() => {
				sector.status = 'rendered' // g->1
				sector.promise = undefined
				SDU?.log(sector, { type: 'done render' })
				this.propagateDebugInformation()
			})
			SDU?.assertInvariant('g', sector.point, this.sectors)
		}
		//})
	}

	async renderSector(sector: Sector<Tile>) {
		const sectorRenderers = this.parts.filter((part) => part.renderSector)
		const { invalidParts } = sector
		sector.invalidParts = new Set()
		// Must be sequential as there is inter-dependency (cf. terrainHeight)
		// TODO: Landscaper must be concurrently
		for (const part of invalidParts ?? sectorRenderers) await part.renderSector!(sector)
	}

	@cached()
	get tileRefiners() {
		return this.parts.filter((part) => part.refineTile)
	}

	asyncCreateSector(sector: Sector<Tile>, precalc: any) {
		const sectorTiles = this.precalcTiles.map((lclCoord, index): [AxialKey, Tile] => {
			const point = axial.coordAccess(axial.linear(sector.center, lclCoord))
			let completeTile = this.tiles.get(point.key)
			if (completeTile) return [point.key, completeTile]
			const tilePrecalc = mapEntries(precalc as Record<string, any>, (v) => v[index]) as Record<
				string,
				any
			>
			const pos = tilePrecalc.positions
			let tile: TileBase = {
				//position: { ...cartesian(point, this.tileSize), z: 0 },
				position: { x: pos[0], y: pos[1], z: pos[2] },
				sectors: [],
			}
			for (const part of this.tileRefiners)
				tile = part.refineTile!(tile, point, tilePrecalc) ?? tile
			completeTile = tile as Tile
			this.tiles.set(point.key, completeTile)
			return [point.key, completeTile]
		})

		sector.tiles = new AxialKeyMap(sectorTiles)
		sector.promise = undefined
		sector.status = 'existing'
	}
	createSectors(added: Iterable<AxialCoord>) {
		const addedArray = Array.from(added)
		const centers = addedArray.map((coord) => this.sector2tile(coord))
		const allSectorsCalculus = this.landKernel.then((kernel) =>
			kernel({ centers: centers.map(({ q, r }) => [q, r]) })
		)
		// No async/await as we need sectors to be created with their promise
		for (let i = 0; i < addedArray.length; ++i) {
			const toSee = addedArray[i]
			const center = centers[i]
			const sector = new Sector(
				this,
				center,
				allSectorsCalculus.then((calculusBunch) => {
					const precalc: any = {}
					for (const c in calculusBunch) precalc[c] = calculusBunch[c][i]
					this.asyncCreateSector(sector, precalc)
				})
			)
			SDU?.assertInvariant('0', toSee, this.sectors)
			this.sectors.set(toSee, sector) // SectorInvariant: 0->1
			SDU?.addIn(this.group, sector)
			this.group.add(sector.group!)
			SDU?.assertStatus(toSee, 'creating', this)
			sector.promise?.then(() => {
				SDU?.log(sector, { type: 'created' })
				if (!sector.markedForDeletion) {
					SDU?.assertInvariant('1', toSee, this.sectors)
					this.markToRender(sector)
				}
				this.propagateDebugInformation()
			})
		}
	}

	/**
	 *
	 * @param removed List of candidates for removal
	 * @param cameras Cameras to check distance with
	 * @param marginBufferSize Distance of removal ration (2 = let the sectors twice the visible distance existing)
	 */
	pruneSectors(removed: AxialSet, cameras: PerspectiveCamera[], marginBufferSize: number) {
		for (const key of removed) {
			const deletedSector = this.sectors.get(key)
			if (deletedSector && !deletedSector.markedForDeletion) {
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
				const freeResources = ((deletedSector: Sector<Tile>) => (direct: boolean) => {
					// SectorInvariant: x->0
					if ((!deletedSector.markedForDeletion && !direct) || !this.sectors.delete(key)) return
					deletedSector.status = 'deleted'
					SDU?.log(deletedSector, { type: `freeResources[${direct ? 'direct' : 'delayed'}]` })
					assert(
						this.group.children.includes(deletedSector.group),
						'Deleted sector group not found'
					)
					this.group.remove(deletedSector.group)
					deletedSector.freeTiles()
					SDU?.assertInvariant('0', key, this.sectors)
					this.propagateDebugInformation()
				})(deletedSector)
				SDU?.log(deletedSector, { type: 'prune' })
				if (!deletedSector.promise) {
					SDU?.assertInvariant('1', key, this.sectors)
					freeResources(true) // SectorInvariant: 1->0
					SDU?.assertInvariant('0', key, this.sectors)
				} else if (!deletedSector.markedForDeletion) {
					// SectorInvariant: g->x
					deletedSector.markedForDeletion = true
					SDU?.log(deletedSector, { type: 'markForDeletion' })
					deletedSector.promise.then(() => freeResources(false))
					SDU?.assertInvariant('x', key, this.sectors)
				}
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
				const sector = this.sectors.get(toSee)
				if (!sector) added.add(toSee)
				else if (sector.markedForDeletion) {
					SDU?.log(sector, { type: 'resuscitate' })
					sector.markedForDeletion = undefined // x -> g
				}
			}
		if (added.size > 0) this.createSectors(added)
		this.pruneSectors(removed, cameras, 1.2)
		this.propagateDebugInformation()
	}

	generateWholeLand() {
		if (!Number.isFinite(this.landRadius)) return
		this.createSectors(axial.enum(this.landRadius))
	}

	// Mark to render, but with a `setTimeout`
	willMarkToRender(sector: Sector<Tile>) {
		sector.invalidParts = undefined
		if (sector.status === 'rendered') {
			sector.status = 'existing'
			setTimeout(() => {
				this.markToRender(sector)
			})
		}
	}

	addPart(...parts: LandPart<Tile>[]) {
		this.parts.push(...parts)
		for (const part of parts)
			part.on('invalidatedRender', (part: LandPart<Tile>, sector: Sector<Tile>) => {
				sector.invalidate(part)
				this.markToRender(sector)
			})
	}

	progress(dt: number) {}

	// #region Tile access

	tile(aRef: AxialRef): Tile {
		const renderedTile = this.tiles.get(aRef)
		if (renderedTile) return renderedTile
		throw new SectorNotGeneratedError(axial.access(aRef).key)
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
