import { Group, type Object3D, Vector3 } from 'three'
import {
	type Axial,
	type AxialCoord,
	type AxialKeyMap,
	type AxialRef,
	AxialSet,
	axial,
	cartesian,
	hexSides,
} from '~/utils'
import type { Land, LandPart, PositionInTile, TileBase } from './land'

export class Sector<Tile extends TileBase> {
	public group = new Group()
	private parts = new Map<LandPart<Tile>, Object3D>()
	public invalidParts?: Set<LandPart<Tile>>
	public readonly attachedTiles = new AxialSet()
	constructor(
		public readonly land: Land<Tile>,
		public readonly center: AxialCoord,
		public readonly tiles: AxialKeyMap<Tile>
	) {
		for (const [_, tile] of this.tiles) tile.sectors.push(this)
	}
	cartesian(point: Axial) {
		return { ...cartesian(point, this.land.tileSize), z: this.tile(point)?.position?.z ?? 0 }
	}
	setPartO3d(part: LandPart<Tile>, o3d: Object3D) {
		const oldO3d = this.parts.get(part)
		if (oldO3d) this.group.remove(oldO3d)
		this.group.add(o3d)
		this.parts.set(part, o3d)
	}
	invalidate(part: LandPart<Tile>) {
		this.invalidParts?.add(part)
	}
	/**
	 * Retrieves a point (xyz) inside a rendered tile
	 * In case of border tiles, positions involving a tile outside of the sector return `null`
	 * Reference: tile
	 * @returns
	 */
	inTile(aRef: AxialRef, { s, u, v }: PositionInTile) {
		const point = axial.access(aRef)
		const next1 = axial.linear(point, hexSides[s])
		const next2 = axial.linear(point, hexSides[(s + 1) % 6])
		if (!this.tiles.has(next1) || !this.tiles.has(next2)) return null
		const pos = new Vector3().copy(this.tiles.get(aRef)!.position)
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
		const { tiles } = this.land
		const removeTiles = (bunch: Iterable<AxialRef>) => {
			for (const point of bunch) {
				const tile = tiles.get(point)
				if (!tile) continue
				tile.sectors = tile.sectors.filter((sector) => sector !== this)
				if (tile.sectors.length === 0) tiles.delete(point)
			}
		}
		removeTiles(this.tiles.keys())
		removeTiles(this.attachedTiles)
	}
	tile(point: Axial) {
		let rv = this.tiles.get(point)
		if (!rv) {
			rv = this.land.tile(point)
			this.tiles.set(point, rv)
		}
		return rv
	}
}
