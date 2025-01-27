import { Group, type Object3D } from 'three'
import type { TileHandle } from '~/ground/landscaper'
import { GameEntity } from './game'

export class TileCursor extends GameEntity {
	private shown = false
	constructor(private readonly mesh: Object3D) {
		super(new Group())
	}

	private _tile?: TileHandle
	get tile(): TileHandle | undefined {
		return this._tile
	}
	set tile(value: TileHandle | undefined) {
		this._tile = value
		const group = this.o3d as Group
		if (value) {
			if (!this.shown) {
				this.shown = true
				group.add(this.mesh)
			}
			group.position.copy(value.tile.position)
		} else if (this.shown) {
			this.shown = false
			group.remove(this.mesh)
		}
	}
	progress(dt: number): void {
		const rotation = this.o3d.rotation
		rotation.x += dt
		rotation.y += dt
	}
}
