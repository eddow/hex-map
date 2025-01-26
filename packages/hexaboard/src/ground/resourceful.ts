import { Group } from 'three'
import type { Handelable } from '~/game'
import type { Land, LandPart, TilePart } from './land'

export interface TileContent extends TilePart {
	content?: (Handelable | undefined)[]
}

export class Resourceful implements LandPart {
	public readonly rendered = new Group()
	constructor(private readonly land: Land) {
		land.addPart(this)
	}
	get tiles() {
		return this.land.tiles as Map<string, TileContent>
	}
	invalidate(added: string[], removed: string[]): void {
		throw new Error('Method not implemented.')
	}
}
