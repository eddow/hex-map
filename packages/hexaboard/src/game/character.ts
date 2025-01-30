import type { Object3D, Vector3, Vector3Like } from 'three'
import type { Land, TileBase } from '~/ground'
import { type AxialKey, type AxialRef, axial } from '~/utils/axial'
import { assert } from '~/utils/debug'
import { GameEntity } from './game'
import { costingPath } from './path'

function terrainWalkCost(from: AxialKey, to: AxialKey) {
	return 1
}

function characterActionError<Details extends any[] = []>(msg: string) {
	return class CharacterActionError extends Error {
		public details: Details
		constructor(...details: Details) {
			super(msg)
			this.details = details
		}
	}
}

export const ActionCancelled = characterActionError<[string]>('Action cancelled')
export const ImpossibleMove = characterActionError<[AxialRef, AxialRef]>('Impossible move')
export const BrokenPath = characterActionError('Broken path')

type Semaphore<Return = void> = {
	promise: Promise<Return>
	resolve: () => Return
	reject: (reason?: any) => void
}
function semaphore<Return = void>() {
	const rv: any = {}
	rv.promise = new Promise<Return>((resolve, reject) => {
		rv.resolve = resolve
		rv.reject = reject
	})
	return rv as Semaphore<Return>
}

export abstract class CharacterAction {
	public done = 0
	private semaphore = semaphore()
	get awaited() {
		return this.semaphore.promise
	}
	constructor(
		public readonly character: Character,
		readonly duration: number
	) {}

	cancel(reason: string) {
		this.semaphore.reject(new ActionCancelled(reason))
	}
	progress() {
		this.done += this.character.availableDt
		if (this.done >= this.duration) {
			this.progression = 1
			this.character.availableDt = this.done - this.duration
			this.character.action = undefined
			this.semaphore.resolve()
		} else {
			this.progression = this.done / this.duration
			this.character.availableDt = 0
		}
	}
	/**
	 * Sets the progression between 0 and 1
	 */
	abstract set progression(alpha: number)
}

export class WalkToTile extends CharacterAction {
	private start: Vector3
	private end: Vector3Like
	constructor(
		character: Character,
		duration: number,
		public readonly destination: AxialKey
	) {
		super(character, duration)
		this.start = character.o3d.position
		this.end = character.land.tile(destination).position
	}
	set progression(alpha: number) {
		if (alpha >= 0.5) this.character.tileKey = this.destination
		this.character.o3d.position.lerpVectors(this.start, this.end, alpha)
	}
}

export type CharacterPlan<Args extends any[] = []> = (
	this: Character,
	...args: Args
) => Promise<void>
export type Progression = (this: Character, alpha: number) => void
export class AnimationAction extends CharacterAction {
	private readonly customProgression: Progression
	constructor(character: Character, duration: number, progression: Progression) {
		super(character, duration)
		this.customProgression = progression
	}
	get name() {
		return this.customProgression.name
	}

	set progression(alpha: number) {
		this.customProgression.call(this.character, alpha)
	}
}

export async function goTo(this: Character, destination: AxialRef) {
	do {
		try {
			const path = costingPath(this.tileKey, terrainWalkCost, (tileKey) => tileKey === destination)
			if (!path) throw new ImpossibleMove(this.tileKey, destination)

			if (this.action instanceof WalkToTile) {
				if (this.action.destination === path[1]) path.shift()
				else {
					// TODO calculate time for walkTo current tile knowing we might be on a road (trip between current tile and destination)
				}
			} else {
				// TODO calculate time for walkTo current tile within tile without road
			}
			for (const tileKey of path) await this.act(new WalkToTile(this, 1, tileKey))
		} catch (e) {
			if (e instanceof BrokenPath) continue
			throw e
		}
		// biome-ignore lint: `continue` is an exception = "try again"
	} while (false)
}

export class Character<Tile extends TileBase = TileBase> extends GameEntity {
	//public action: CharacterAction = idle
	public tileKey: AxialKey
	public action?: CharacterAction
	public availableDt = 0
	constructor(
		public readonly land: Land<Tile>,
		o3d: Object3D,
		tileKey?: AxialKey
	) {
		super(o3d)
		if (tileKey !== undefined) {
			const tile = land.tile(tileKey)
			this.tileKey = tileKey
			o3d.position.copy(tile.position)
		} else this.tileKey = axial.key(land.tileAt(o3d.position))
	}

	get position() {
		return this.o3d.position
	}

	get tile() {
		return this.land.tile(this.tileKey)
	}

	progress(dt: number) {
		if (this.action) {
			this.availableDt = dt
			this.action.progress()
			assert(this.availableDt === 0, 'progression must be 0 when done')
		}
	}

	public async execute<Args extends any[] = []>(plan: CharacterPlan<Args>, ...args: Args) {
		try {
			await plan.apply(this, args)
		} catch (e) {
			if (e instanceof ActionCancelled) return false
			throw e
		}
		return true
	}
	protected act(action: CharacterAction) {
		if (this.action) this.action.cancel('re-planing')
		this.action = action
		if (this.availableDt > 0) action.progress()
	}
}
