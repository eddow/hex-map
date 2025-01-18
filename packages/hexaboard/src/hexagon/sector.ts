import {
	BufferAttribute,
	BufferGeometry,
	Group,
	type Intersection,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	type Object3DEventMap,
	Vector3,
} from 'three'
import { meshVectors3 } from '~/utils/meshes'
import type { RandGenerator } from '~/utils/misc'
import { type MouseReactive, TileHandle } from '~/utils/mouseControl'
import { axialAt, axialIndex, axialPolynomial, cartesian, hexSides, hexTiles } from './utils'
export interface TilePosition {
	s: number
	u: number
	v: number
}

/**
 * Mostly abstract hex sector, has to be overridden
 */
export default class HexSector implements MouseReactive {
	constructor(
		position: Vector3,
		public readonly tileSize: number,
		public readonly radius: number
	) {
		this.group.position.copy(position)
	}
	group: Group = new Group()
	ground?: Group

	mouseHandle(intersection: Intersection<Object3D<Object3DEventMap>>): TileHandle {
		const positions = Array.from(meshVectors3(intersection.object as Mesh))
		const distances = positions.map((p) => p.distanceTo(intersection.point))
		const minD = Math.min(...distances)

		return new TileHandle(this, intersection.object.userData?.points[distances.indexOf(minD)])
	}

	triangleGeometry(ndx: [number, number, number]) {
		const geometry = new BufferGeometry()

		const positions = new Float32Array(
			ndx.map((n) => this.vPosition(n)).reduce<number[]>((p, c) => [...p, c.x, c.y, c.z], [])
		)
		geometry.setAttribute('position', new BufferAttribute(positions, 3))
		return geometry
	}
	//#region To override

	vPosition(ndx: number) {
		return new Vector3().copy({ ...cartesian(axialAt(ndx), this.tileSize), z: 0 })
	}

	triangle(ndx: [number, number, number], side: number): Mesh {
		return new Mesh(
			this.triangleGeometry(ndx),
			new MeshBasicMaterial({ color: Math.floor(Math.random() * 0x1000000) })
		)
	}

	//#endregion

	get nbrTiles() {
		return hexTiles(this.radius)
	}
	meshTriangles(radius: number) {
		const rv: Mesh[] = []
		const mesh = (a: number, b: number, c: number, side: number) => {
			const nm = this.triangle([a, b, c], side)
			nm.userData = { points: [a, b, c], mouseTarget: this }
			rv.push(nm)
		}
		for (let ring = 1; ring < radius; ring++) {
			for (let side = 0; side < 6; side++) {
				for (let offset = 0; offset < ring; offset++) {
					const index1 = hexTiles(ring) + side * ring + offset
					const index2 = hexTiles(ring) + ((side * ring + offset + 1) % (6 * ring))
					const index3 =
						ring === 1 ? 0 : hexTiles(ring - 1) + ((side * (ring - 1) + offset) % (6 * (ring - 1)))
					mesh(index1, index3, index2, side)
					if (offset > 0) {
						const index4 =
							hexTiles(ring - 1) + ((side * (ring - 1) + offset - 1) % (6 * (ring - 1)))
						mesh(index1, index4, index3, (side + 1) % 6)
					}
				}
			}
		}
		return rv
	}
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
		this.ground = new Group()
		this.group.add(this.ground)
		this.ground.add(...this.meshTriangles(this.radius))
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
