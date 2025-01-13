import { MeshBasicMaterial, Vector3 } from 'three'
import type { RandGenerator } from '~/utils/random'
import HexSector from '../sector'
import { axialAt, cartesian } from '../utils'

/**
 * A simple hexagonal sector with random colors
 */
export class HexClown extends HexSector {
	vPosition(ndx: number) {
		return new Vector3().copy({ ...cartesian(axialAt(ndx), this.tileSize), z: 0 })
	}
	triangleMaterial(gen: RandGenerator, ...ndx: [number, number, number]) {
		return new MeshBasicMaterial({ color: Math.floor(gen() * 0x1000000) })
	}
}
