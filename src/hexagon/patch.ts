import {
	BufferAttribute,
	BufferGeometry,
	Group,
	type Intersection,
	type Material,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	type Object3DEventMap,
	type Scene,
	SphereGeometry,
} from 'three'
import type { RandGenerator } from '~/utils/lcg'
import { Cacheable } from '../utils/decorators'
import type { MouseAction, MouseReactive } from '../utils/mouse'
import { type V2, vDistance } from '../utils/vectors'
import { cartesian, hexAt, hexTiles } from './utils'
const { floor, min } = Math

export interface Measures {
	tileSize: number
	position: V2
	scene: Scene
	gen: RandGenerator
}

/**
 * Mostly abstract hex patch, has to be overridden
 */
export default abstract class HexPatch extends Cacheable implements MouseReactive {
	constructor(
		public readonly measures: Measures,
		public readonly radius: number
	) {
		super()
	}

	highlighted?: number
	highlight?: Mesh
	mouse(
		action: MouseAction,
		intersection: Intersection<Object3D<Object3DEventMap>> | undefined
	): void {
		const { scene, tileSize } = this.measures
		switch (action) {
			case 'move':
				if (intersection) {
					const p = (intersection.object as Mesh).geometry.attributes.position
					const positions = []
					for (let i = 0; i < p.count; i++) {
						positions.push({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) })
					}
					const distances = positions.map((p) => vDistance(p, intersection.point))
					const minD = min(...distances)
					const hl = intersection.object.userData?.points[distances.indexOf(minD)]

					if (hl !== this.highlighted) {
						this.highlighted = hl
						if (!this.highlight) {
							const sphereGeometry = new SphereGeometry(tileSize, 32, 32)
							const sphereMaterial = new MeshBasicMaterial({
								color: 0x8080ff,
								transparent: true,
								opacity: 0.5,
							})
							this.highlight = new Mesh(sphereGeometry, sphereMaterial)
							scene.add(this.highlight)
						}
						this.highlight?.position.copy(this.vPosition(hl))
					}
				} else {
					this.highlighted = undefined
					if (this.highlight) {
						scene.remove(this.highlight)
						this.highlight = undefined
					}
				}
				break
		}
	}
	abstract vPosition(ndx: number): { x: number; y: number; z: number }
	abstract triangleMaterial(...ndx: [number, number, number]): Material | undefined

	triangleGeometry(...ndx: [number, number, number]) {
		const geometry = new BufferGeometry()

		const positions = new Float32Array(
			ndx.map((n) => this.vPosition(n)).reduce<number[]>((p, c) => [...p, c.x, c.y, c.z], [])
		)

		geometry.setAttribute('position', new BufferAttribute(positions, 3))

		return geometry
	}
	get nbrTiles() {
		return hexTiles(this.radius)
	}
	genTriangles(radius: number) {
		const rv: Mesh[] = []
		const mesh = (a: number, b: number, c: number) => {
			const nm = new Mesh(this.triangleGeometry(a, b, c), this.triangleMaterial(a, b, c))
			nm.userData = { points: [a, b, c], item: this }
			rv.push(nm)
		}
		for (let circle = 1; circle < radius; circle++) {
			for (let side = 0; side < 6; side++) {
				for (let offset = 0; offset < circle; offset++) {
					const index1 = hexTiles(circle) + side * circle + offset
					const index2 = hexTiles(circle) + ((side * circle + offset + 1) % (6 * circle))
					const index3 =
						circle === 1
							? 0
							: hexTiles(circle - 1) + ((side * (circle - 1) + offset) % (6 * (circle - 1)))
					mesh(index1, index3, index2)
					if (offset > 0) {
						const index4 =
							hexTiles(circle - 1) + ((side * (circle - 1) + offset - 1) % (6 * (circle - 1)))
						mesh(index1, index4, index3)
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
		return { ...cartesian(hexAt(ndx), this.measures.tileSize), z: 0 }
	}
	triangleMaterial(...ndx: [number, number, number]) {
		return new MeshBasicMaterial({ color: floor(this.measures.gen() * 0x1000000) })
	}
}
/**
 * We can construct a patch with 2 more sides (`puzzleTiles` tiles) so that they can nest into each another in an infinite board
 */
