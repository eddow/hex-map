import { BufferAttribute, BufferGeometry, MeshBasicMaterial, NormalBufferAttributes } from 'three'
import HexPatch, { type Measures } from './patch'
import { type Axial, axialIndex, cartesian, hexAt, hexSides, polynomial } from './utils'

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
		return { ...cartesian(hexAt(ndx), this.measures.tileSize), z: this.points[ndx].z }
	}
}

interface HeightPoint extends BasePoint {
	c: { r: number; g: number; b: number }
}
export class HeightPowGen extends HexPow2Gen<HeightPoint> {
	initCorners(corners: number[]): void {
		this.points[0] = { z: 10, c: { r: 1, g: 1, b: 0 } }
		for (const corner of corners) this.points[corner] = { z: -5, c: { r: 0, g: 0, b: 1 } }
	}
	insidePoint(p1: HeightPoint, p2: HeightPoint, scale: number): HeightPoint {
		const randScale = ((1 << scale) * this.measures.tileSize) / 2
		return {
			z: (p1.z + p2.z) / 2 + (Math.random() - 0.5) * randScale,
			c: { r: Math.random(), g: Math.random(), b: 0 },
		}
	}
	triangleGeometry(...ndx: [number, number, number]) {
		const geometry = super.triangleGeometry(...ndx)

		const colors = new Float32Array(
			ndx.map((n) => this.points[n].c).reduce<number[]>((p, c) => [...p, c.r, c.g, c.b], [])
		)
		geometry.setAttribute('color', new BufferAttribute(colors, 3))
		return geometry
	}
	triangleMaterial(...ndx: [number, number, number]) {
		return new MeshBasicMaterial({
			vertexColors: true, // Enable vertex colors
		})
	}
}
