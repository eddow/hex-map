import { Group, type Object3D, type PerspectiveCamera, Vector3, type Vector3Like } from 'three'
import {
	assert,
	type Axial,
	type AxialIndex,
	type AxialKey,
	type AxialRef,
	axial,
	cartesian,
	debugInformation,
	fromCartesian,
	hexSides,
	hexTiles,
	numbers,
} from '~/utils'
import { logPerformances, resetPerformances } from '~/utils/decorators'

export interface TileBase {
	position: Vector3Like
	// Number of sectors it has been generated in (find an alternative solution, many "1" to store)
	sectors: Sector<TileBase>[]
}

export type TileUpdater<Tile extends TileBase> = (
	updaters: Sector<Tile>[],
	aRef: AxialRef,
	tile?: Partial<Tile>
) => void

export interface LandPart<Tile extends TileBase, GenerationInfo = unknown> {
	/**
	 * Refine tile information
	 * @param tile
	 * @param coords
	 */
	refineTile?(tile: TileBase, coords: Axial, generationInfo: GenerationInfo): undefined | Tile
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
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function cameraVision(camera: PerspectiveCamera): number {
	return camera.far / Math.cos((camera.fov * Math.PI) / 360)
}

function* sectorsToRender(centerRef: AxialRef, camera: PerspectiveCamera, size: number) {
	const center = axial.round(centerRef)
	const centerCartesian = cartesian(center, size)
	// Estimate the maximum axial distance. Since a hexagon's circumradius is sqrt(3) * side length,
	// we use D / (sqrt(3) * size) as an upper bound for axial distance check.
	const vision = cameraVision(camera)
	const maxAxialDistance = Math.ceil(vision / size + 0.5)
	// TODO: Browse with axialIndex now that we have maxAxialDistance
	// Check all hexagons within this range
	for (let dq = -maxAxialDistance; dq <= maxAxialDistance; dq++) {
		for (
			let dr = Math.max(-maxAxialDistance, -dq - maxAxialDistance);
			dr <= Math.min(maxAxialDistance, -dq + maxAxialDistance);
			dr++
		) {
			const currentHex = { q: center.q + dq, r: center.r + dr }
			const currentCartesian = cartesian(currentHex, size)

			// Check if the Cartesian distance is within D
			if (distance(centerCartesian, currentCartesian) <= vision) {
				yield currentHex
			}
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

export class Sector<Tile extends TileBase> {
	public group?: Group
	public readonly attachedTiles = new Set<AxialKey>()
	constructor(
		public readonly land: Land<Tile>,
		public readonly center: Axial,
		public readonly tiles: Tile[]
	) {
		for (const tile of this.tiles) tile.sectors.push(this)
	}
	cartesian(hexIndex: AxialIndex, tiles?: Tile[]) {
		return { ...cartesian(hexIndex, this.land.tileSize), z: tiles?.[hexIndex]?.position?.z ?? 0 }
	}
	tileCoords(aRef: AxialRef) {
		return axial.linear(aRef, this.center)
	}
	add(o3d: Object3D) {
		assert(this.group, 'Rendering should happen in an existing sector')
		this.group.add(o3d)
	}
	/**
	 * Retrieves a point (xyz) inside a rendered tile
	 * In case of border tiles, positions involving a tile outside of the sector return `null`
	 * Reference: tile
	 * @returns
	 */
	inTile(tiles: Tile[], aRef: AxialRef, { s, u, v }: PositionInTile) {
		const coords = axial.coords(aRef)
		const next1 = axial.index(axial.linear(coords, hexSides[s]))
		const next2 = axial.index(axial.linear(coords, hexSides[(s + 1) % 6]))
		const nbrTiles = tiles.length
		if (next1 >= nbrTiles || next2 >= nbrTiles) return null
		const pos = new Vector3().copy(tiles[axial.index(aRef)].position)
		const next1dir = new Vector3()
			.copy(tiles[next1].position)
			.sub(pos)
			.multiplyScalar(u / 2)
		const next2dir = new Vector3()
			.copy(tiles[next2].position)
			.sub(pos)
			.multiplyScalar(v / 2)
		return pos.add(next1dir).add(next2dir)
	}
	freeTiles() {
		const { center } = this
		const { tiles } = this.land
		const removeTiles = (bunch: Iterable<AxialKey>) => {
			for (const tileKey of bunch) {
				const tile = tiles.get(tileKey)!
				tile.sectors = tile.sectors.filter((sector) => sector !== this)
				if (tile.sectors.length === 0) tiles.delete(tileKey)
			}
		}
		const sectorTileKeys = numbers(hexTiles(this.land.sectorRadius)).map((hexIndex) =>
			axial.key(axial.linear(hexIndex, center))
		)
		removeTiles(sectorTileKeys)
		removeTiles(this.attachedTiles)
	}
}

function scaleAxial({ q, r }: Axial, scale: number) {
	return {
		q: (q + 2 * r) * scale,
		r: (q - r) * scale,
	}
}

export class Land<Tile extends TileBase = TileBase> {
	public readonly tiles = new Map<string, Tile>()
	private readonly parts: LandPart<Tile>[] = []
	public readonly group = new Group()
	private readonly sectors = new Map<AxialKey, Sector<Tile>>()
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
		return scaleAxial(axial.coords(aRef), this.sectorRadius - 1)
	}
	tile2sector(aRef: AxialRef) {
		return axial.round(scaleAxial(axial.coords(aRef), 1 / (3 * (this.sectorRadius - 1))))
	}

	createSectors(added: Map<AxialKey, Axial>, generationInfos: Map<LandPart<Tile>, any>) {
		const tileRefiners = this.parts.filter((part) => part.refineTile)
		for (const [key, toSee] of added) {
			const center = this.sector2tile(toSee)
			const sectorTiles = numbers(hexTiles(this.sectorRadius)).map((hexIndex) => {
				const coords = axial.linear(axial.coords(hexIndex), center)
				const key = axial.key(coords)
				let completeTile = this.tiles.get(key)
				if (completeTile) {
					completeTile.sectors
					return completeTile
				}
				let tile: TileBase = {
					position: { ...cartesian(coords, this.tileSize), z: 0 },
					sectors: [],
				}
				for (const part of tileRefiners)
					tile = part.refineTile!(tile, coords, generationInfos.get(part)) ?? tile
				completeTile = tile as Tile
				this.tiles.set(axial.key(coords), completeTile)
				return completeTile
			})
			const sector = new Sector(this, center, sectorTiles)
			this.sectors.set(key, sector)
			this.sectorsToRender.add(sector)
		}
	}

	spreadGeneration(generationInfos: Map<LandPart<Tile>, any>) {
		const modifier = (sectors: Sector<Tile>[], aRef: AxialRef, mod?: Partial<Tile>) => {
			const tile = this.getTile(axial.coords(aRef))
			if (mod) Object.assign(tile, mod)
			for (const sector of sectors)
				if (!tile.sectors.includes(sector)) {
					tile.sectors.push(sector)
					sector.attachedTiles.add(axial.key(aRef))
				}
			for (const sector of tile.sectors) this.sectorsToRender.add(sector as Sector<Tile>)
		}
		for (const part of this.parts)
			if (part.spreadGeneration) part.spreadGeneration(modifier, generationInfos.get(part))
	}

	renderSectors() {
		const sectorRenderers = this.parts.filter((part) => part.renderSector)
		for (const sector of this.sectorsToRender) {
			if (sector.group) this.group.remove(sector.group)
			sector.group = new Group()
			for (const part of sectorRenderers) part.renderSector!(sector)
			this.group.add(sector.group)
		}
		this.sectorsToRender.clear()
	}

	/**
	 *
	 * @param removed List of candidates for removal
	 * @param cameras Cameras to check distance with
	 * @param marginBufferSize Distance of removal ration (2 = let the sectors twice the visible distance existing)
	 */
	pruneSectors(removed: Set<AxialKey>, cameras: PerspectiveCamera[], marginBufferSize: number) {
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
			this.sectors.delete(key)
			const center = deletedSector.center
			deletedSector.freeTiles()
		}
	}

	sectorsToRender = new Set<Sector<Tile>>()
	updateViews(cameras: PerspectiveCamera[]) {
		// At first, plan to remove all sectors
		const removed = new Set(this.sectors.keys())
		const generationInfos = new Map<LandPart<Tile>, any>()
		resetPerformances()
		const added = new Map<AxialKey, Axial>()
		for (const camera of cameras)
			for (const toSee of sectorsToRender(
				this.tile2sector(fromCartesian(camera.position, this.tileSize)),
				camera,
				this.tileSize * this.sectorRadius
			)) {
				const key = axial.key(toSee)
				// If we cannot cancel the deletion of a sector, it means we need to add it
				removed.delete(key)
				if (!this.sectors.has(key) && !added.has(key)) added.set(key, toSee)
			}
		if (added.size > 0) {
			this.sectorsToRender ??= new Set()
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

	getTile(aRef: AxialRef): Tile {
		const key = axial.key(aRef)
		const renderedTile = this.tiles.get(key)
		if (renderedTile) return renderedTile
		return this.generateOneTile(aRef)
	}

	temporaryTiles = new Map<AxialKey, Tile>()
	generateOneTile(aRef: AxialRef) {
		const key = axial.key(aRef)
		const coords = axial.coords(aRef)
		const generationInfos = new Map<LandPart<Tile>, any>()
		for (const part of this.parts)
			if (part.beginGeneration) generationInfos.set(part, part.beginGeneration())
		let tile: TileBase = {
			position: { ...cartesian(key, this.tileSize), z: 0 },
			sectors: [],
		}
		for (const part of this.parts)
			if (part.refineTile) tile = part.refineTile(tile, coords, generationInfos.get(part)) ?? tile
		const completeTile = tile as Tile
		this.tiles.set(axial.key(coords), completeTile)
		this.temporaryTiles.set(key, completeTile)
		return completeTile
	}

	addPart(part: LandPart<Tile>) {
		this.parts.push(part)
	}

	progress(dt: number) {
		this.renderSectors()
		for (const [key, tile] of this.temporaryTiles) if (!tile.sectors.length) this.tiles.delete(key)
		this.temporaryTiles.clear()
	}
}
