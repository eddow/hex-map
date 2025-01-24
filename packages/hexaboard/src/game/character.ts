import type { Object3D, Vector3 } from 'three'
import { GameEntity } from '~/game/game'
import { type AxialRef, axial } from '~/utils/axial'
import { costingPath } from './path'
import type { TileSpec } from './tile'

// TODO: Test the whole and write terrainCost
function terrainCost(from: string, to: string) {
	return 1
}

export class ImpossibleMoveError extends Error {
	constructor(
		public readonly from: AxialRef,
		public readonly to: AxialRef
	) {
		super('impossible move')
	}
}

export interface CharacterPlan {
	next(character: Character): CharacterAction | undefined
	cancel?(character: Character): void
	plan?: CharacterPlan
}
export interface CharacterAction {
	advance(character: Character, dt: number): number | undefined
	cancel?(character: Character): void
	plan: CharacterPlan
}
export const idle = { advance: () => 0, plan: { next: () => idle } }

class Walk implements CharacterAction {
	constructor(
		public plan: CharacterPlan,
		public destination: Vector3,
		public done?: (character: Character) => void
	) {}
	advance(character: Character, dt: number) {
		const velocity = 20
		const direction = this.destination.clone().sub(character.o3d.position)
		const time = direction.length() / velocity
		if (time < dt) {
			character.o3d.position.copy(this.destination)
			this.done?.(character)
			return dt - time
		}
		character.o3d.position.add(direction.normalize().multiplyScalar(dt * velocity))
	}
	cancel(character: Character) {
		character.tile = character.tile.land.tile(character.o3d.position)
	}
}

class GoToPlan implements CharacterPlan {
	private path: AxialRef[]
	constructor(
		public plan: CharacterPlan,
		from: AxialRef,
		public destination: AxialRef
	) {
		const destKey = axial.key(destination)
		const path = costingPath(axial.key(from), terrainCost, (target) => target === destKey)
		if (!path) throw new Error('no path')
		this.path = path
	}
	next(character: Character) {
		if (!this.path.length) return
		const next = character.tile.land.tile(this.path.unshift())
		return new Walk(this, next.center, () => {
			character.tile = next
		})
	}
}

export class Character extends GameEntity {
	public action: CharacterAction = idle

	constructor(
		public tile: TileSpec,
		o3d: Object3D
	) {
		super(o3d)
		o3d.position.copy(tile.center)
	}

	progress(dt: number) {
		let remainingDt = this.action.advance(this, dt) ?? 0
		while (remainingDt > 0) {
			let tree: CharacterPlan | undefined = this.action.plan
			let next: CharacterAction | undefined
			while (!next && tree) {
				next = tree.next(this)
				tree = tree.plan
			}
			if (!next) throw new Error('no next action')
			this.action = next
			remainingDt = this.action.advance(this, remainingDt) ?? 0
		}
	}

	goTo(destination: AxialRef) {
		const plan = new GoToPlan(idle.plan, this.tile.key, destination)
		const next = plan.next(this)
		this.action.cancel?.(this)
		for (
			let planTree: CharacterPlan | undefined = this.action.plan;
			planTree;
			planTree = planTree.plan
		)
			planTree.cancel?.(this)
		if (next) {
			if (this.action instanceof Walk && this.action.destination.equals(next.destination))
				this.action = next
			else this.action = new Walk(plan, this.tile.center)
		}
	}
}
