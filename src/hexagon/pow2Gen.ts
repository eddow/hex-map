import { BufferAttribute, BufferGeometry, MeshBasicMaterial, NormalBufferAttributes } from 'three'
import LCG from '~/utils/lcg'
import HexPatch, { type Measures } from './patch'
import {
	type Axial,
	axialDistance,
	axialIndex,
	cartesian,
	hexAt,
	hexSides,
	polynomial,
} from './utils'

const { max, floor } = Math

const wholeScale = 80

const terrainTypes = {
	sand: {
		color: { r: 0.8, g: 0.8, b: 0 },
		minHeight: Number.NEGATIVE_INFINITY,
	},
	grass: {
		color: { r: 0.4, g: 0.8, b: 0.4 },
		minHeight: 10,
	},
	forest: {
		color: { r: 0, g: 0.9, b: 0 },
		minHeight: 30,
	},
	stone: {
		color: { r: 0.2, g: 0.2, b: 0.2 },
		minHeight: 45,
	},
	snow: {
		color: { r: 0.9, g: 0.9, b: 0.9 },
		minHeight: 60,
	},
}

function terrainType(height: number) {
	let rvH = Number.NEGATIVE_INFINITY
	let rvT: keyof typeof terrainTypes = 'sand'
	for (const type in terrainTypes) {
		const thisH = terrainTypes[type as keyof typeof terrainTypes].minHeight
		if (height >= thisH && thisH > rvH) {
			rvH = thisH
			rvT = type as keyof typeof terrainTypes
		}
	}
	return rvT
}
interface BasePoint {
	z: number
}

interface PointSpec {
	scale: number
	point: Axial
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
					{ scale, point: mids[i] }
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
	abstract insidePoint(p1: Point, p2: Point, specs: PointSpec): Point

	vPosition(ndx: number) {
		return { ...cartesian(hexAt(ndx), this.measures.tileSize), z: max(this.points[ndx].z, 0) }
	}
}

interface HeightPoint extends BasePoint {
	type: keyof typeof terrainTypes
	seed: number
}

function getColor(point: HeightPoint) {
	const { z } = point
	const p = 1.1 ** z
	return z > 0 ? terrainTypes[point.type].color : { r: p / 2, g: p / 2, b: 1 }
}

export class HeightPowGen extends HexPow2Gen<HeightPoint> {
	initCorners(corners: number[]): void {
		const { gen } = this.measures
		this.points[0] = { z: (wholeScale * 3) / 4, type: 'snow', seed: gen() }
		for (const corner of corners)
			this.points[corner] = { z: -wholeScale / 4, type: 'sand', seed: gen() }
	}
	insidePoint(p1: HeightPoint, p2: HeightPoint, { scale, point }: PointSpec): HeightPoint {
		const randScale =
			((1 << scale) / this.radius) * wholeScale * (1 - axialDistance(point) / (this.radius - 1))
		const seed = LCG(p1.seed, p2.seed)()
		const gen = LCG(seed)
		const z = (p1.z + p2.z) / 2 + gen(0.5, -0.5) * randScale
		const changeType = gen() < scale / this.scale
		const type = changeType ? terrainType(z) : [p1, p2][floor(gen(2))].type
		return {
			z: z,
			type,
			seed,
		}
	}
	triangleGeometry(...ndx: [number, number, number]) {
		const geometry = super.triangleGeometry(...ndx)

		const colors = new Float32Array(
			ndx
				.map((n) => this.points[n])
				.map(getColor)
				.reduce<number[]>((p, c) => [...p, c.r, c.g, c.b], [])
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
