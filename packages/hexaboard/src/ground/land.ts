import { Group, type PerspectiveCamera, type Vector3Like } from 'three'
import {
	assert,
	type Axial,
	type AxialRef,
	type HexKey,
	axial,
	cartesian,
	defined,
	fromCartesian,
	hexTiles,
	numbers,
} from '~/utils'
import { logPerformances, resetPerformances } from '~/utils/decorators'

export interface TileBase {
	position: Vector3Like
	//terrain: string
	sectors: number
}

export interface LandPart<Tile extends TileBase> {
	refineTile?(tile: TileBase, coords: Axial): undefined | Tile
	// Add Object3D to sector.group
	renderSector?(sector: Sector<Tile>, tiles: Tile[]): void
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}
// This should be higher if triangles are seen being generated on the "coin of the eyes"
const experimentalBufferSize = 0

export function* hexagonsWithinCartesianDistance(
	centerRef: AxialRef,
	D: number,
	cameraFOV: number,
	size: number
) {
	const center = axial.round(centerRef)
	const centerCartesian = cartesian(center, size)
	const hFOV = (cameraFOV * Math.PI) / 180 // Convert FOV to radians

	const adjustedD = D / Math.cos(hFOV / 2) + experimentalBufferSize
	// Estimate the maximum axial distance. Since a hexagon's circumradius is sqrt(3) * side length,
	// we use D / (sqrt(3) * size) as an upper bound for axial distance check.
	const maxAxialDistance = Math.ceil(adjustedD / size)

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
			if (distance(centerCartesian, currentCartesian) <= adjustedD) {
				yield currentHex
			}
		}
	}
}

export class Sector<Tile extends TileBase> {
	readonly group = new Group()
	constructor(
		public readonly land: Land<Tile>,
		public readonly center: Axial
	) {}
	tileCoords(aRef: AxialRef) {
		return axial.linear(aRef, this.center)
	}
}

function scaleAxial({ q, r }: Axial, scale: number) {
	return {
		q: (q + 2 * r) * scale,
		r: (q - r) * scale,
	}
}

export class Land<Tile extends TileBase> {
	public readonly tiles = new Map<string, Tile>()
	private readonly parts: LandPart<Tile>[] = []
	public readonly group = new Group()
	private readonly sectors = new Map<HexKey, Sector<Tile>>()
	public readonly sectorRadius: number
	constructor(
		public readonly sectorScale: number,
		public readonly tileSize: number
	) {
		// Sectors share their border, so sectors of 1 tile cannot tile a world
		assert(sectorScale > 0, 'sectorScale must be strictly > 0')
		this.sectorRadius = 1 << sectorScale
	}

	sector2tile(aRef: AxialRef) {
		return scaleAxial(axial.coords(aRef), this.sectorRadius - 1)
	}
	tile2sector(aRef: AxialRef) {
		return axial.round(scaleAxial(axial.coords(aRef), 1 / (3 * (this.sectorRadius - 1))))
	}
	updateViews(cameras: PerspectiveCamera[]) {
		// At first, plan to remove all sectors
		const removed = new Set(this.sectors.keys())
		const camera = cameras[0]
		resetPerformances()
		const tileRefiners = this.parts.filter((part) => part.refineTile)
		const sectorRenderers = this.parts.filter((part) => part.renderSector)
		for (const toSee of hexagonsWithinCartesianDistance(
			this.tile2sector(fromCartesian(camera.position, this.tileSize)),
			camera.far,
			camera.fov,
			this.tileSize * this.sectorRadius
		)) {
			const key = axial.key(toSee)
			// If we cannot cancel the deletion of a sector, it means we need to add it
			if (!removed.delete(key)) {
				const center = this.sector2tile(toSee)
				const sector = new Sector(this, center)
				this.sectors.set(key, sector)
				const sectorTiles = numbers(hexTiles(this.sectorRadius)).map((hexIndex) => {
					const coords = axial.linear(axial.coords(hexIndex), center)
					const key = axial.key(coords)
					let completeTile = this.tiles.get(key)
					if (completeTile) {
						completeTile.sectors++
						return completeTile
					}
					let tile = {
						position: { ...cartesian(coords, this.tileSize), z: 0 },
						sectors: 1,
					}
					for (const part of tileRefiners) tile = part.refineTile!(tile, coords) ?? tile
					completeTile = tile as Tile
					this.tiles.set(axial.key(coords), completeTile)
					return completeTile
				})
				for (const part of sectorRenderers) part.renderSector!(sector, sectorTiles)
				this.group.add(sector.group)
			}
		}
		// TODO: Don't remove directly, let a margin unseen but not removed
		for (const key of removed) {
			const sector = this.sectors.get(key)!
			this.group.remove(sector.group)
			this.sectors.delete(key)
			const center = sector.center
			const sectorTileKeys = numbers(hexTiles(this.sectorRadius)).map((hexIndex) =>
				axial.key(axial.linear(hexIndex, center))
			)
			for (const tileKey of sectorTileKeys) {
				const tile = this.tiles.get(tileKey)!
				if (--tile.sectors === 0) this.tiles.delete(tileKey)
			}
		}

		logPerformances()
	}

	getTile(aRef: AxialRef) {
		const key = axial.key(aRef)
		return defined(this.tiles.get(key), 'TODO: generate if needed')
	}

	addPart(part: LandPart<Tile>) {
		this.parts.push(part)
	}

	progress(dt: number) {}
}
