import { MeshBasicMaterial } from 'three'
import HexSector from '../section'
import { axialAt, cartesian } from '../utils'

const { floor } = Math

/**
 * A simple hexagonal sector with random colors
 */
export class HexClown extends HexSector {
	vPosition(ndx: number) {
		return { ...cartesian(axialAt(ndx), this.measures.tileSize), z: 0 }
	}
	triangleMaterial(...ndx: [number, number, number]) {
		return new MeshBasicMaterial({ color: floor(this.measures.gen() * 0x1000000) })
	}
}
