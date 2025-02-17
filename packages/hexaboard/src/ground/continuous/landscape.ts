import {
	type Material,
	Mesh,
	type PickingInfo,
	TransformNode,
	Vector3,
	type VertexData,
} from '@babylonjs/core'
import type { Game } from '~/game'
import type { MouseHandle, MouseHandler } from '~/input'
import type { Triplet } from '~/types'
import { type Axial, type AxialCoord, Eventful } from '~/utils'
import type { RenderedEvents, TileBase } from '../land'
import type { Landscape } from '../landscaper'
import type { Sector } from '../sector'

export interface LandscapeTriangle<A = Axial> {
	side: 0 | 1
	points: Triplet<A>
}

export function* sectorTriangles(
	maxAxialDistance: number
): Generator<LandscapeTriangle<AxialCoord>> {
	for (let r = -maxAxialDistance; r < maxAxialDistance; r++) {
		const qFrom = Math.max(1 - maxAxialDistance, -r - maxAxialDistance)
		const qTo = Math.min(maxAxialDistance, -r + maxAxialDistance)
		if (r < 0) {
			yield {
				side: 0,
				points: [
					{ q: qTo, r },
					{ q: qTo, r: r + 1 },
					{ q: qTo - 1, r: r + 1 },
				],
			}
		} else {
			yield {
				side: 1,
				points: [
					{ q: qFrom - 1, r },
					{ q: qFrom, r },
					{ q: qFrom - 1, r: r + 1 },
				],
			}
		}
		for (let q = qFrom; q < qTo; q++) {
			yield {
				side: 0,
				points: [
					{ q, r },
					{ q, r: r + 1 },
					{ q: q - 1, r: r + 1 },
				],
			}
			yield {
				side: 1,
				points: [
					{ q, r },
					{ q: q + 1, r },
					{ q: q, r: r + 1 },
				],
			}
		}
	}
}

export function axialCoordIndex(point: AxialCoord, array: AxialCoord[]) {
	let rv = array.findIndex((p) => p.q === point.q && p.r === point.r)
	if (rv === -1) {
		rv = array.length
		array.push(point)
	}
	return rv
}
function computeBarycentricCoordinates(
	p: Vector3,
	vct: Triplet<Vector3>
): [number, number, number] {
	const v0v1 = vct[1].subtract(vct[0])
	const v0v2 = vct[2].subtract(vct[0])
	const v0p = p.subtract(vct[0])

	const d00 = Vector3.Dot(v0v1, v0v1)
	const d01 = Vector3.Dot(v0v1, v0v2)
	const d11 = Vector3.Dot(v0v2, v0v2)
	const d20 = Vector3.Dot(v0p, v0v1)
	const d21 = Vector3.Dot(v0p, v0v2)

	const denom = d00 * d11 - d01 * d01
	const v = (d11 * d20 - d01 * d21) / denom
	const w = (d00 * d21 - d01 * d20) / denom
	const u = 1.0 - v - w

	return [u, v, w] // Barycentric coordinates (α, β, γ)
}

export interface SectorElements {
	triangles: LandscapeTriangle<number>[]
	geometryVertex: AxialCoord[]
}

export abstract class ContinuousLandscape<Tile extends TileBase>
	extends Eventful<RenderedEvents<Tile>>
	implements Landscape<Tile>
{
	readonly name = 'continuous'

	constructor(protected readonly game: Game) {
		super()
	}
	nameFor(sector: Sector<Tile>) {
		return `${this.name}#${sector.point.q}|${sector.point.r}`
	}
	abstract getSectorElements(sector: Sector<Tile>): Promise<SectorElements>
	protected abstract createVertexData(
		sector: Sector<Tile>,
		triangles: LandscapeTriangle<number>[],
		vertex: AxialCoord[]
	): Promise<VertexData>
	async createSector3D(sector: Sector<Tile>): Promise<TransformNode> {
		const sectorElements = await this.getSectorElements(sector)
		if (!sectorElements?.triangles.length) return new TransformNode(this.nameFor(sector))
		const { triangles, geometryVertex } = sectorElements
		const vertexData = await this.createVertexData(sector, triangles, geometryVertex)
		const mesh = new Mesh(this.nameFor(sector), this.game.gameView.scene)
		mesh.material = this.material
		vertexData.applyToMesh(mesh)
		mesh.setIndices(triangles.flatMap(({ points }) => points))
		if (this.mouseHandler)
			mesh.metadata = {
				mouseHandler: ((pick: PickingInfo) =>
					this.rawMouseHandler(sector, pick)) satisfies MouseHandler,
			}
		return mesh
	}
	abstract getTriangle(sector: Sector<Tile>, index: number): Triplet<Axial>
	rawMouseHandler(sector: Sector<Tile>, pick: PickingInfo) {
		const points = this.getTriangle(sector, pick.faceId)
		const bary = computeBarycentricCoordinates(
			pick.pickedPoint!,
			points.map((p) => sector.position(p)) as Triplet<Vector3>
		)
		return this.mouseHandler!(sector, points, bary)
	}
	mouseHandler?(
		sector: Sector<Tile>,
		points: Triplet<Axial>,
		bary: Triplet<number>
	): MouseHandle | undefined
	protected abstract material: Material
}
