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
	triangleMaterial() {
		return new MeshBasicMaterial({ color: Math.floor(Math.random() * 0x1000000) })
	}
}
