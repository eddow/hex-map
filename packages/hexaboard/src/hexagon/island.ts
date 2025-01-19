import { Vector2, Vector3 } from 'three'
import type { TerrainType } from '~/game/terrain'
import type { RandGenerator } from '~/utils/misc'
import { HeightPowGen, type TexturedTile } from './textured'
import { axialAt, cartesian } from './utils'

export interface DisplacedPoint extends TexturedTile {
	radius: number
}

export class Island extends HeightPowGen<DisplacedPoint> {
	displacedPoint(
		z: number,
		radius: number, // Distance from the center
		type: TerrainType,
		gen: RandGenerator,
		seed?: number
	) {
		return {
			...this.heightTile(z, type, gen, seed),
			radius,
		}
	}
	initCorners(corners: number[], gen: RandGenerator): void {
		const extRadius = 1 << this.scale
		this.points[0] = this.displacedPoint(
			this.terrains.terrainHeight,
			0,
			this.terrains.terrains.center,
			gen
		)
		for (const corner of corners)
			this.points[corner] = this.displacedPoint(
				-this.terrains.terrainHeight * 0.5,
				extRadius,
				this.terrains.terrains.perimeter,
				gen
			)
	}
	insidePoint(p1: DisplacedPoint, p2: DisplacedPoint, scale: number): DisplacedPoint {
		const rv = super.insidePoint(p1, p2, scale)
		return { ...rv, radius: (p1.radius + p2.radius) / 2 }
	}
	vPosition(ndx: number) {
		const point = this.points[ndx]
		const hv = new Vector2().copy(cartesian(axialAt(ndx)))
		if (hv.x !== 0 || hv.y !== 0) hv.multiplyScalar((this.tileSize * point.radius) / hv.length())
		return new Vector3(hv.x, hv.y, Math.max(point.z, 0))
	}
}
