import { type Camera, Group, type Object3D, type RGB, type Vector3Like } from 'three'
import type { Handelable } from '~/game'
import { axial, hexTiles, numbers } from '~/utils'
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

export class Land {
	public readonly tiles = new Map<string, Tile>()
	private readonly parts = new Set<LandRenderer>()
	public readonly group = new Group()

	constructor(public readonly natureGenerator: NatureGenerator) {}

	updateViews(cameras: Camera[]) {
		if (this.tiles.size === 0) {
			const added = numbers(hexTiles(4)).map((i) => axial.key(i))
			for (const a of added)
				this.tiles.set(axial.key(a), { nature: this.natureGenerator.getNature(axial.coords(a)) })
			for (const part of this.parts) part.invalidate(added, [])
		}
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
