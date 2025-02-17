import type { Mesh } from '@babylonjs/core'
import type { TileHandle } from '~/ground/landscaper'
import { GameEntity } from './game'
// TODO: cf HighlightLayer
export class TileCursor extends GameEntity {
	private shown = false
	constructor(private readonly mesh: Mesh) {
		super(mesh)
		mesh.setEnabled(false)
		mesh.isPickable = false
	}

	private _tile?: TileHandle
	get tile(): TileHandle | undefined {
		return this._tile
	}
	set tile(value: TileHandle | undefined) {
		this._tile = value
		this.node.setEnabled(value !== undefined)
		if (!value) return
		this.node.position = value.position
	}
}
