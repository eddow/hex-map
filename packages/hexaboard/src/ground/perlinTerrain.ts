import { f32 } from 'webgpgpu.ts'
import type { Pair } from '~/types'
import { type Axial, Eventful } from '~/utils'
import type { LandGpGpu, LandPart, RenderedEvents, TileBase, WalkTimeSpecification } from './land'

export interface PerlinConfiguration {
	/**
	 * How zoomed ou a terrain look. A small number will bring very varying small details while a big number will make big smooth surfaces
	 * Usually, two peaks will be separated by 5~10 * scale
	 */
	scale: number
	/**
	 * [min, max] of the expected number
	 * @default [0,1]
	 */
	variation?: Pair<number>
}

export class PerlinTerrain<Tile extends TileBase, Keys extends PropertyKey>
	extends Eventful<RenderedEvents<Tile>>
	implements LandPart<Tile>
{
	constructor(
		private readonly configurations: Record<Keys, PerlinConfiguration>,
		private readonly cpuCalculus: (from: TileBase, generation: Record<Keys, number>) => Tile,
		public readonly walkTimeMultiplier: (
			movement: WalkTimeSpecification<Tile>
		) => number | undefined = () => undefined
	) {
		super()
	}
	calculus(wgg: LandGpGpu): LandGpGpu {
		let rv = wgg.import('noiseSimplex2d')
		for (const key in this.configurations) {
			const { variation, scale } = this.configurations[key]
			let v = `simplex2d_fractal(position.xy*${scale}f, seed)`
			if (variation) v = `mix(${variation[0]}, ${variation[1]}, ${v})`
			rv = rv
				.code({ computations: `${key}[dot(thread.yx, ${key}Stride)] = ${v};` })
				.output({ [key]: f32.array('threads.y', 'threads.x') })
		}
		return rv
	}
	refineTile(tile: TileBase, _: Axial, tilePrecalc: Record<string, any>): Tile {
		return this.cpuCalculus(tile, tilePrecalc as Record<Keys, number>)
	}
}
