// TODO: "hexagon" -> "sector" & "utils.ts" -> "hexagon.ts"
import {
	BufferAttribute,
	BufferGeometry,
	type Face,
	Float32BufferAttribute,
	Group,
	type Intersection,
	type Material,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	type Object3DEventMap,
	Vector3,
} from 'three'
import type { RandGenerator } from '~/utils/misc'
import { type MouseReactive, TileHandle } from '~/utils/mouseControl'
import { axialAt, axialIndex, axialPolynomial, cartesian, hexSides, hexTiles } from './hexagon'
export interface TilePosition {
	s: number
	u: number
	v: number
}

export interface PositionPointInfo {
	position: Vector3
}
export interface PositionGeometryAttribute {
	position: number[]
}
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

// TODO !! Calculate instead of caching
let pointsHexIndex: number[] = []

/**
 * Mostly abstract hex sector, has to be overridden
 */
export default class HexSector<
	PointInfo extends PositionPointInfo = PositionPointInfo,
	GeometryAttribute extends PositionGeometryAttribute = PositionGeometryAttribute,
> implements MouseReactive
{
	constructor(
		position: Vector3,
		public readonly tileSize: number,
		public readonly radius: number
	) {
		this.group.position.copy(position)
	}
	group: Group = new Group()
	ground?: Object3D

	mouseHandle(intersection: Intersection<Object3D<Object3DEventMap>>): TileHandle {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		return new TileHandle(this, pointsHexIndex[geomPt])
	}

	triangleGeometry(ndx: [number, number, number]) {
		const geometry = new BufferGeometry()

		const positions = new Float32Array(
			ndx.map((n) => this.vPosition(n)).reduce<number[]>((p, c) => [...p, c.x, c.y, c.z], [])
		)
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		return geometry
	}
	vPosition(ndx: number) {
		return new Vector3().copy({ ...cartesian(axialAt(ndx), this.tileSize), z: 0 })
	}

	get nbrTiles() {
		return hexTiles(this.radius)
	}

	// #region Geometry

	protected get initialGeometryAttributes(): GeometryAttribute {
		return { position: [] as number[] } as GeometryAttribute
	}
	protected setGeometryAttributes(geometry: BufferGeometry, attributes: GeometryAttribute) {
		geometry.setAttribute('position', new Float32BufferAttribute(attributes.position, 3))
	}
	protected geometryPointInfos(hexIndex: number): PointInfo {
		return { position: this.vPosition(hexIndex) } as PointInfo
	}
	protected addGeometryAttributes(
		geometryAttributes: GeometryAttribute,
		[a, b, c]: [number, number, number],
		[A, B, C]: [PointInfo, PointInfo, PointInfo],
		side: number
	) {
		geometryAttributes.position.push(
			...A.position.toArray(),
			...B.position.toArray(),
			...C.position.toArray()
		)
	}
	protected createGeometry() {
		const pointInfos: PointInfo[] = []
		for (let hI = 0; hI < this.nbrTiles; hI++) pointInfos.push(this.geometryPointInfos(hI))
		const attributes = this.initialGeometryAttributes
		pointsHexIndex = []
		for (const [a, b, c, side] of sectorTriangles(this.radius)) {
			pointsHexIndex.push(a, b, c)
			this.addGeometryAttributes(
				attributes,
				[a, b, c],
				[pointInfos[a], pointInfos[b], pointInfos[c]],
				side
			)
		}

		const geometry = new BufferGeometry()
		this.setGeometryAttributes(geometry, attributes)
		return geometry
	}

	protected createMaterial(): Material {
		return new MeshBasicMaterial({
			color: 0xffffff,
			wireframe: true,
		})
	}

	protected createMesh() {
		const mesh = new Mesh(this.createGeometry(), this.createMaterial())
		mesh.userData = { mouseTarget: this }
		return mesh
	}

	// #endregion
	/**
	 * "Load from scratch" - this should be called *even* when loading games
	 */
	generate(gen: RandGenerator) {}
	/**
	 * Generates the primal state that will be saved and then loaded
	 */
	virgin() {}
	meshContent() {}
	meshTerrain() {
		if (this.ground) this.group.remove(this.ground)
		this.ground = this.createMesh()
		this.group.add(this.ground)
	}

	cartesian(tile: number, { s, u, v }: TilePosition) {
		const axial = axialAt(tile)
		const next1 = axialIndex(axialPolynomial([1, axial], [1, hexSides[s]]))
		const next2 = axialIndex(axialPolynomial([1, axial], [1, hexSides[(s + 1) % 6]]))
		if (next1 >= this.nbrTiles || next2 >= this.nbrTiles) return null
		const pos = this.vPosition(tile)
		const next1Pos = this.vPosition(next1).sub(pos)
		const next2Pos = this.vPosition(next2).sub(pos)
		return next1Pos.multiplyScalar(u / 2).add(next2Pos.multiplyScalar(v / 2))
	}
}
