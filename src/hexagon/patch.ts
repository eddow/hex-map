import {
	BufferAttribute,
	BufferGeometry,
	Group,
	type Material,
	Mesh,
	MeshBasicMaterial,
} from 'three'
import { Cacheable } from '../utils/decorators'
import { type Hex, axial, cartesian, computeAxial, hexTiles } from './utils'
const { floor } = Math

export interface Measures {
	tileSize: number
	position: Hex
}

/**
 * Mostly abstract hex patch, has to be overridden
 */
export default abstract class HexPatch extends Cacheable {
	constructor(
		public readonly measures: Measures,
		public readonly radius: number
	) {
		super()
		const tiles = this.nbrTiles
		computeAxial(tiles)
	}
	abstract vPosition(ndx: number): { x: number; y: number; z: number }
	abstract triangleMaterial(...ndx: [number, number, number]): Material

	createTriangleMesh(...ndx: [number, number, number]) {
		const geometry = new BufferGeometry()

		const positions = new Float32Array(
			ndx.map((n) => this.vPosition(n)).reduce<number[]>((p, c) => [...p, c.x, c.y, c.z], [])
		)

		geometry.setAttribute('position', new BufferAttribute(positions, 3))

		return new Mesh(geometry, this.triangleMaterial(...ndx))
	}
	get nbrTiles() {
		return hexTiles(this.radius)
	}
	genTriangles(radius: number) {
		const rv: Mesh[] = []
		for (let circle = 1; circle < radius; circle++) {
			for (let side = 0; side < 6; side++) {
				for (let offset = 0; offset < circle; offset++) {
					const index1 = hexTiles(circle) + side * circle + offset
					const index2 = hexTiles(circle) + ((side * circle + offset + 1) % (6 * circle))
					const index3 =
						circle === 1
							? 0
							: hexTiles(circle - 1) + ((side * (circle - 1) + offset) % (6 * (circle - 1)))
					rv.push(this.createTriangleMesh(index1, index3, index2))
					if (offset > 0) {
						const index4 =
							hexTiles(circle - 1) + ((side * (circle - 1) + offset - 1) % (6 * (circle - 1)))
						rv.push(this.createTriangleMesh(index1, index4, index3))
					}
				}
			}
		}
		return rv
	}
	// @cached // Not supported by Vite
	get group() {
		return this.cached('group', () => {
			const rv = new Group()
			const { x, y } = this.measures.position
			rv.add(...this.genTriangles(this.radius)).position.set(x, y, 0)
			return rv
		})
	}
}

/**
 * A simple hexagonal patch with random colors
 */
export class HexClown extends HexPatch {
	vPosition(ndx: number) {
		return { ...cartesian(axial[ndx], this.measures.tileSize), z: 0 }
	}
	triangleMaterial(...ndx: [number, number, number]) {
		return new MeshBasicMaterial({ color: floor(Math.random() * 0x1000000) })
	}
}
/**
 * We can construct a patch with 2 more sides (`puzzleTiles` tiles) so that they can nest into each another in an infinite board
 */
