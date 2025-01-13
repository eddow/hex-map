import { BufferAttribute, Group, MeshBasicMaterial, Vector3 } from 'three'
import { type Handelable, generateResources } from '~/game/handelable'
import { type Terrain, terrainType, terrainTypes, wholeScale } from '~/game/terrain'
import { type TerrainTexture, genTexture } from '~/game/texture'
import LCG, { type RandGenerator } from '~/utils/random'
import HexSector from './sector'
import {
	type Axial,
	axialAt,
	axialIndex,
	axialPolynomial,
	cartesian,
	hexSides,
	hexTiles,
	posInTile,
} from './utils'

/**
 * Number of hexagonal "circles" around the center of sub-tiles that can contain something
 */
const terrainContentRadius = 1

interface BasePoint {
	z: number
	group?: Group
}

interface PointSpec {
	scale: number
	point: Axial
}

export default abstract class HexPow2Gen<Point extends BasePoint = BasePoint> extends HexSector {
	readonly points: Point[] = []
	constructor(
		position: Vector3,
		tileSize: number,
		public readonly scale: number
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
	abstract initCorners(corners: number[], gen: RandGenerator): void
	abstract insidePoint(p1: Point, p2: Point, specs: PointSpec): Point
	abstract populatePoint(p: Point, position: Axial, hexIndex: number): void

	vPosition(ndx: number) {
		return new Vector3().copy({
			...cartesian(axialAt(ndx), this.tileSize),
			z: Math.max(this.points[ndx].z, 0),
		})
	}
}

interface HeightPoint extends BasePoint {
	type: Terrain
	seed: number
	content: (Handelable | undefined)[]
	texture: TerrainTexture
}

function newPoint(z: number, type: Terrain, gen: RandGenerator, seed?: number): HeightPoint {
	return { z, type, seed: seed ?? gen(), content: [], texture: genTexture(gen) }
}

function getColor(point: HeightPoint) {
	const { z } = point
	const p = 1.1 ** z
	return z > 0 ? terrainTypes[point.type].color : { r: p / 2, g: p / 2, b: 1 }
}

// TODO: Use textures instead of colors

export class HeightPowGen extends HexPow2Gen<HeightPoint> {
	initCorners(corners: number[], gen: RandGenerator): void {
		this.points[0] = newPoint(wholeScale, 'snow', gen)
		for (const corner of corners)
			this.points[corner] =
				//{ z: -wholeScale * 0.5, type: 'sand', seed: gen(), artifacts: [] }
				newPoint(-wholeScale * 0.5, 'sand', gen)
	}
	insidePoint(p1: HeightPoint, p2: HeightPoint, { scale }: PointSpec): HeightPoint {
		const variance = (terrainTypes[p1.type].variance + terrainTypes[p2.type].variance) / 2
		const randScale = ((1 << scale) / this.radius) * wholeScale * variance
		const seed = LCG(p1.seed, p2.seed)()
		const gen = LCG(seed)
		const z = (p1.z + p2.z) / 2 + gen(0.5, -0.5) * randScale
		const changeType = gen() < scale / this.scale
		const type = changeType ? terrainType(z) : [p1, p2][Math.floor(gen(2))].type
		return newPoint(z, type, gen, seed)
	}
	meshAllArtifacts() {}

	meshResources() {
		for (let hexIndex = 0; hexIndex < this.nbrTiles; hexIndex++) {
			const p = this.points[hexIndex]
			if (p.content.length) {
				if (!p.group) {
					p.group = new Group()
					p.group.position.copy(this.vPosition(hexIndex))
					this.group.add(p.group)
				}
				for (let i = 0; i < p.content.length; i++)
					if (p.content[i]) {
						const pos = this.cartesian(hexIndex, posInTile(i, terrainContentRadius))
						// Pos is null when no neighbor sector is present and the resource is out of rendering zone on the border
						if (pos) {
							const rsc = p.content[i]!
							if (!rsc.builtMesh) {
								const mesh = rsc.createMesh()
								mesh.position.copy(pos)
								p.group.add(mesh)
							}
						}
					}
			}
		}
	}
	populatePoint(p: HeightPoint, position: Axial, hexIndex: number): void {
		const gen = LCG(p.seed + 0.2)
		if (p.z > 0)
			p.content = Array.from(
				generateResources(gen, terrainTypes[p.type], hexTiles(terrainContentRadius + 1))
			)
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
	triangleMaterial(ndx: [number, number, number], side: number) {
		return new MeshBasicMaterial({
			vertexColors: true, // Enable vertex colors
		})
	}
}
