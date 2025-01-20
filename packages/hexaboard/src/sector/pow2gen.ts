import { type Group, Vector3 } from 'three'
import type { TerrainsDefinition } from '~/sector/terrain'
import type { RandGenerator } from '~/utils/misc'
import HexSector, { type PositionGeometryAttribute, type PositionPointInfo } from './base'
import { type Axial, axialAt, axialIndex, axialPolynomial, cartesian, hexSides } from './hexagon'

export interface HeightTile {
	z: number
	group?: Group
}

export default abstract class HexPow2Gen<
	Tile extends HeightTile = HeightTile,
	PointInfo extends PositionPointInfo = PositionPointInfo,
	GeometryAttribute extends PositionGeometryAttribute = PositionGeometryAttribute,
> extends HexSector<PointInfo, GeometryAttribute> {
	readonly points: Tile[] = []
	constructor(
		position: Vector3,
		tileSize: number,
		public readonly scale: number,
		public readonly terrains: TerrainsDefinition
	) {
		super(position, tileSize, 1 + (1 << scale))
	}
	generate(gen: RandGenerator) {
		const corners = hexSides.map((side) => axialPolynomial([1 << this.scale, side]))
		this.initCorners(corners.map(axialIndex), gen)
		for (let c = 0; c < 6; c++)
			this.divTriangle(this.scale, corners[c], corners[(c + 1) % 6], { q: 0, r: 0 })
		super.generate(gen)
	}
	/**
	 * Initialize the points from a virgin sector (generate random resources and artifacts)
	 */
	virgin() {
		for (let t = 0; t < this.nbrTiles; t++) this.populatePoint(this.points[t], axialAt(t), t)
	}
	divTriangle(scale: number, ...triangle: Axial[]) {
		if (scale === 0) return

		const points = triangle.map(axialIndex)
		const mids = triangle.map((a, i) => axialPolynomial([0.5, a], [0.5, triangle[(i + 1) % 3]]))
		const midPoints = mids.map(axialIndex)
		for (let i = 0; i < 3; i++)
			if (!this.points[midPoints[i]])
				this.points[midPoints[i]] = this.insidePoint(
					this.points[points[i]],
					this.points[points[(i + 1) % 3]],
					scale
				)
		if (scale > 0) {
			this.divTriangle(scale - 1, ...mids)
			for (let i = 0; i < 3; i++)
				this.divTriangle(scale - 1, triangle[i], mids[i], mids[(i + 2) % 3])
		}
	}
	/**
	 * Initiate the custom data of the center (index 0) and corners (given 6 indices) points
	 * @param corners Indices of the corners
	 */
	abstract initCorners(corners: number[], gen: RandGenerator): void
	abstract insidePoint(p1: Tile, p2: Tile, scale: number): Tile
	abstract populatePoint(p: Tile, position: Axial, hexIndex: number): void

	vPosition(ndx: number) {
		return new Vector3().copy({
			...cartesian(axialAt(ndx), this.tileSize),
			z: Math.max(this.points[ndx].z, 0),
		})
	}
}
