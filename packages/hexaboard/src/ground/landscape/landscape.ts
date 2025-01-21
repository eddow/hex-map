import {
	BufferGeometry,
	Float32BufferAttribute,
	type Material,
	Mesh,
	MeshBasicMaterial,
	Vector3,
	type Vector3Tuple,
} from 'three'
import { numbers } from '~/utils/numbers'
import { axialAt, axialIndex, axialPolynomial, cartesian, hexSides, hexTiles } from '../hexagon'
import type Sector from '../sector'
import type { TileBase } from '../sector'

export function* sectorTriangles(radius: number) {
	for (let ring = 1; ring < radius; ring++) {
		for (let side = 0; side < 6; side++) {
			for (let offset = 0; offset < ring; offset++) {
				const index1 = hexTiles(ring) + side * ring + offset
				const index2 = hexTiles(ring) + ((side * ring + offset + 1) % (6 * ring))
				const index3 =
					ring === 1 ? 0 : hexTiles(ring - 1) + ((side * (ring - 1) + offset) % (6 * (ring - 1)))
				yield [index1, index3, index2, side]
				if (offset > 0) {
					const index4 = hexTiles(ring - 1) + ((side * (ring - 1) + offset - 1) % (6 * (ring - 1)))
					yield [index1, index4, index3, (side + 1) % 6]
				}
			}
		}
	}
}

/**
 * Represents the position of a point in a tile
 */
export interface PositionInTile {
	/** Side [0..6[ */
	s: number
	/** 2D coordinate in side triangle */
	u: number
	/** 2D coordinate in side triangle */
	v: number
}

// TODO !! Calculate instead of caching
const pointsHexIndex: number[] = []

export interface PositionPointInfo {
	position: Vector3Tuple
}
export interface PositionGeometryAttribute {
	position: number[]
}
export abstract class LandscapeBase<
	Tile extends TileBase = TileBase,
	PointInfo extends PositionPointInfo = PositionPointInfo,
	GeometryAttribute extends PositionGeometryAttribute = PositionGeometryAttribute,
> {
	constructor(public readonly tileSize: number) {}
	protected get initialGeometryAttributes(): GeometryAttribute {
		return { position: [] as number[] } as GeometryAttribute
	}
	protected setGeometryAttributes(geometry: BufferGeometry, attributes: GeometryAttribute) {
		geometry.setAttribute('position', new Float32BufferAttribute(attributes.position, 3))
	}
	protected geometryPointInfos(sector: Sector<Tile>, hexIndex: number): PointInfo {
		return { position: this.tileCenter(sector, hexIndex).toArray() } as PointInfo
	}

	protected addGeometryAttributes(
		geometryAttributes: GeometryAttribute,
		[A, B, C]: [PointInfo, PointInfo, PointInfo],
		side: number
	) {
		geometryAttributes.position.push(...A.position, ...B.position, ...C.position)
	}

	protected createGeometry(sector: Sector<Tile>): BufferGeometry {
		const pointInfos: PointInfo[] = numbers(sector.tiles.length).map((i) =>
			this.geometryPointInfos(sector, i)
		)
		const attributes = this.initialGeometryAttributes
		let phiI = 0
		for (const [a, b, c, side] of sectorTriangles(sector.land.procedural.radius)) {
			if (++phiI > pointsHexIndex.length / 3) pointsHexIndex.push(a, b, c)
			this.addGeometryAttributes(attributes, [pointInfos[a], pointInfos[b], pointInfos[c]], side)
		}

		const geometry = new BufferGeometry()
		this.setGeometryAttributes(geometry, attributes)
		return geometry
	}

	protected abstract get material(): Material

	createMesh(sector: Sector<Tile>) {
		const mesh = new Mesh(this.createGeometry(sector), this.material)
		mesh.userData = { mouseTarget: sector }
		return mesh
	}

	hexIndex(geometryIndex: number) {
		return pointsHexIndex[geometryIndex]
	}

	/**
	 * Retrieves the exact (xyz) position of a tile
	 */
	tileCenter(sector: Sector<Tile>, hexIndex: number) {
		return new Vector3()
			.copy({
				...cartesian(axialAt(hexIndex), this.tileSize),
				z: sector.tiles[hexIndex].z,
			})
			.add(sector.group.position)
	}

	/**
	 * Retrieves a point (xyz) inside a tile
	 * @returns
	 */
	cartesian(sector: Sector<Tile>, hexIndex: number, { s, u, v }: PositionInTile) {
		const axial = axialAt(hexIndex)
		const next1 = axialIndex(axialPolynomial([1, axial], [1, hexSides[s]]))
		const next2 = axialIndex(axialPolynomial([1, axial], [1, hexSides[(s + 1) % 6]]))
		const nbrTiles = sector.tiles.length
		if (next1 >= nbrTiles || next2 >= nbrTiles) return null
		const pos = this.tileCenter(sector, hexIndex)
		const next1Pos = this.tileCenter(sector, next1).sub(pos)
		const next2Pos = this.tileCenter(sector, next2).sub(pos)
		return next1Pos.multiplyScalar(u / 2).add(next2Pos.multiplyScalar(v / 2))
	}
}

export class WireFrameLandscape<Tile extends TileBase = TileBase> extends LandscapeBase<
	Tile,
	PositionPointInfo,
	PositionGeometryAttribute
> {
	protected get material() {
		return new MeshBasicMaterial({
			color: 0xffffff,
			wireframe: true,
		})
	}
}
