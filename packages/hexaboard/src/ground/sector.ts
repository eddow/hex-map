import { type Group, type Object3D, Vector3 } from 'three'
import { type Axial, type AxialKey, type AxialRef, axial, cartesian, hexSides } from '~/utils'
import { assert } from '~/utils/debug'
import type { Land, PositionInTile, TileBase } from './land'

export class Sector<Tile extends TileBase> {
	public group?: Group
	public readonly attachedTiles = new Set<AxialKey>()
	constructor(
		public readonly land: Land<Tile>,
		public readonly center: Axial,
		public readonly tiles: Map<AxialKey, Tile>
	) {
		for (const [_, tile] of this.tiles) tile.sectors.push(this)
	}
	cartesian(aKey: AxialKey, tiles?: Map<AxialKey, Tile>) {
		return { ...cartesian(aKey, this.land.tileSize), z: tiles?.get(aKey)?.position?.z ?? 0 }
	}
	// TODO: remove
	tileCoords(aRef: AxialRef) {
		return axial.coords(aRef)
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
	inTile(aRef: AxialRef, { s, u, v }: PositionInTile) {
		const coords = axial.coords(aRef)
		const next1 = axial.key(axial.linear(coords, hexSides[s]))
		const next2 = axial.key(axial.linear(coords, hexSides[(s + 1) % 6]))
		if (!this.tiles.has(next1) || !this.tiles.has(next2)) return null
		const pos = new Vector3().copy(this.tiles.get(axial.key(aRef))!.position)
		const next1dir = new Vector3()
			.copy(this.tiles.get(next1)!.position)
			.sub(pos)
			.multiplyScalar(u / 2)
		const next2dir = new Vector3()
			.copy(this.tiles.get(next2)!.position)
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
		const sectorTileKeys = this.tiles.keys()
		removeTiles(sectorTileKeys)
		removeTiles(this.attachedTiles)
	}
}
