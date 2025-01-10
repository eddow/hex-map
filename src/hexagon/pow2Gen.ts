import { MeshBasicMaterial } from 'three'
import HexPatch, { type Measures } from './patch'
import { type Axial, axial, axialIndex, cartesian, hexSides, polynomial } from './utils'

interface BasePoint {
	z: number
}

export default abstract class HexPow2Gen<Point extends BasePoint = BasePoint> extends HexPatch {
	readonly points: Point[] = []
	constructor(
		measures: Measures,
		public readonly scale: number
	) {
		super(measures, 1 + (1 << scale))
		const corners = hexSides.map((side) => polynomial([1 << scale, side]))
		this.initCorners(corners.map(axialIndex))
		for (let c = 0; c < 6; c++) {
			this.divTriangle(scale, corners[c], corners[(c + 1) % 6], { q: 0, r: 0 })
		}
	}
	divTriangle(scale: number, ...triangle: Axial[]) {
		if (scale === 0) return
		const points = triangle.map(axialIndex)
		const mids = triangle.map((a, i) => polynomial([0.5, a], [0.5, triangle[(i + 1) % 3]]))
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
	abstract initCorners(corners: number[]): void
	abstract insidePoint(p1: Point, p2: Point, scale: number): Point

	vPosition(ndx: number) {
		return { ...cartesian(axial[ndx], this.measures.tileSize), z: this.points[ndx].z }
	}
	triangleMaterial(...ndx: [number, number, number]) {
		return new MeshBasicMaterial({ color: Math.random() * 0x1000000 })
	}
}

interface HeightPoint extends BasePoint {
	color: number
}
export class HeightPowGen extends HexPow2Gen<HeightPoint> {
	initCorners(corners: number[]): void {
		this.points[0] = { z: 10, color: 0xff }
		for (const corner of corners) this.points[corner] = { z: -5, color: 0xff0000 }
	}
	insidePoint(p1: HeightPoint, p2: HeightPoint, scale: number): HeightPoint {
		const randScale = ((1 << scale) * this.measures.tileSize) / 2
		return {
			z: (p1.z + p2.z) / 2 + (Math.random() - 0.5) * randScale,
			color: Math.random() * 0x1000000,
		}
	}
}
