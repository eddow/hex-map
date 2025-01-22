import { DoubleSide, Mesh, MeshBasicMaterial, type Object3D, Shape, ShapeGeometry } from 'three'
import type {} from '~/game'
import type { ResourcefulTerrain } from '~/game/handelable'
import type { Axial } from '~/utils'
import type { TileBase } from '../sector'
import { PuzzleSector } from './puzzle'
import { type ResourcefulInit, ResourcefulLand } from './resourceful'

export type WateredInit<
	Terrain extends ResourcefulTerrain = ResourcefulTerrain,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> = ResourcefulInit<Terrain, Tile> & {
	/**
	 * It's indeed defined in ResourcefulInit, I let it here in case of transformation to mixins
	 */
	seaLevel: number
}
export class WateredSector<Tile extends TileBase = TileBase> extends PuzzleSector<Tile> {
	private water?: Object3D
	createHexagon(radius: number) {
		const hexagonShape = new Shape()

		hexagonShape.moveTo(radius, 0)

		for (let i = 1; i <= 6; i++) {
			const angle = (i * Math.PI) / 3 // 60 degrees offset for hexagon
			const x = radius * Math.cos(angle)
			const y = radius * Math.sin(angle)
			hexagonShape.lineTo(x, y)
		}

		const geometry = new ShapeGeometry(hexagonShape)

		const material = new MeshBasicMaterial({
			color: 0x0000ff,
			side: DoubleSide,
			opacity: 0.5,
			transparent: true,
		})

		const hexagon = new Mesh(geometry, material)
		hexagon.position.z = (this.land as WateredLand).seaLevel
		return hexagon
	}
	landscape(terrain: Object3D): void {
		super.landscape(terrain)
		if (!this.water) {
			this.water = this.createHexagon(
				this.land.landscape.tileSize * (this.land.procedural.radius - 1) * Math.sqrt(3)
			)
		}
		this.group.add(this.water)
	}
}

export class WateredLand<
	Terrain extends ResourcefulTerrain = ResourcefulTerrain,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends ResourcefulLand<Terrain, Tile> {
	seaLevel: number
	constructor(init: WateredInit<Terrain, Tile>) {
		super(init)
		this.seaLevel = init.seaLevel
	}
	createSector(tiles: Tile[], seed: number, axial: Axial, ...args: any[]): PuzzleSector<Tile> {
		return new WateredSector<Tile>(this, tiles, seed, axial)
	}
}
