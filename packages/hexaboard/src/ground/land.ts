import { Group, type Object3D, type PerspectiveCamera, type RGB, type Vector3Like } from 'three'
import type { Handelable } from '~/game'
import { type AxialRef, axial, cartesian, fromCartesian } from '~/utils'
import type { TileKey } from './landscape'
import type { NatureGenerator } from './natureGenerator'

export interface TilePart {
	dirty?: true
}

export interface TileNature {
	color: RGB
	position: Vector3Like
	terrain: string
}

export interface TileContent extends TilePart {
	content: (Handelable | undefined)[]
}

export interface Tile {
	nature?: TileNature
	content?: TileContent
}

export interface LandRenderer {
	invalidate(added: string[], removed: string[]): void
	readonly rendered: Object3D
}

function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
	return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}
export function* hexagonsWithinCartesianDistance(
	centerRef: AxialRef,
	D: number,
	cameraFOV: number,
	size: number
) {
	const center = axial.round(centerRef)
	const centerCartesian = cartesian(center, size)
	const hFOV = (cameraFOV * Math.PI) / 180 // Convert FOV to radians

	const adjustedD = D / Math.cos(hFOV / 2)
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

export class Land {
	public readonly tiles = new Map<string, Tile>()
	private readonly parts = new Set<LandRenderer>()
	public readonly group = new Group()

	constructor(public readonly natureGenerator: NatureGenerator) {}
	get tileSize() {
		return this.natureGenerator.tileSize
	}
	updateViews(cameras: PerspectiveCamera[]) {
		const removed = new Set(this.tiles.keys())
		const added: TileKey[] = []
		const camera = cameras[0]
		// TODO: Don't remove directly, let a margin unseen but not removed
		for (const toSee of hexagonsWithinCartesianDistance(
			fromCartesian(camera.position, 20),
			camera.far,
			camera.fov,
			20
		)) {
			const key = axial.key(toSee)
			if (!removed.delete(key)) added.push(key)
		}
		for (const a of added)
			this.tiles.set(axial.key(a), { nature: this.natureGenerator.getNature(axial.coords(a)) })
		if (removed.size || added.length)
			for (const part of this.parts) part.invalidate(added, Array.from(removed))
		for (const tileKey of removed) this.tiles.delete(tileKey)
	}

	addPart(part: LandRenderer) {
		this.parts.add(part)
		this.group.add(part.rendered)
	}
	removePart(part: LandRenderer) {
		this.parts.delete(part)
		this.group.remove(part.rendered)
	}

	progress(dt: number) {}
}
