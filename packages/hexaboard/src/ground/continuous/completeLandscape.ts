import type { HandledMouseEvents } from '~/mouse'
import type { Triplet } from '~/types'
import type { Axial } from '~/utils'
import type { TileBase } from '../land'
import { TileHandle } from '../landscaper'
import type { Sector } from '../sector'
import { ContinuousLandscape } from './landscape'

export abstract class CompleteLandscape<Tile extends TileBase> extends ContinuousLandscape<
	Tile,
	HandledMouseEvents<TileHandle<Tile>>
> {
	mouseHandler?(
		sector: Sector<Tile>,
		points: Triplet<Axial>,
		bary: Triplet<number>
	): TileHandle<Tile> {
		return new TileHandle(this, sector, points[bary.indexOf(Math.max(...bary))])
	}
}
