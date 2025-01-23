import type { Object3D, Vector3 } from 'three'
import { GameEntity } from '~/game/game'
import type Sector from '~/ground/sector'
import sector from '~/ground/sector'
import { axial, fromCartesian } from '~/utils/axial'
import { nextInPath } from './path'

// TODO Redo without sectors

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
		public destination: Vector3,
		public plan: CharacterPlan,
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
		character.tile = axial.index(
			axial.round(fromCartesian(character.o3d.position, character.sector.tileSize))
		)
	}
}

// TODO: Cache the path and reevaluate if something changed
class GoToPlan implements CharacterPlan {
	constructor(
		public sector: Sector,
		public tile: number,
		public plan: CharacterPlan
	) {}
	next(character: Character) {
		if (character.sector === this.sector && character.tile === this.tile) return
		const next = axial.index(nextInPath(character.sector, character.tile, this.sector, this.tile))
		return new Walk(character.sector.tileCenter(next), this, () => {
			character.tile = next
		})
	}
}

export class Character extends GameEntity {
	public action: CharacterAction = idle

	constructor(
		public tile: number,
		o3d: Object3D
	) {
		super(o3d)
		o3d.position.copy(sector.tileCenter(tile).add(sector.group.position))
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

	goTo(sector: Sector, hexIndex: number) {
		const plan = new GoToPlan(sector, hexIndex, idle.plan)
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
			else this.action = new Walk(this.sector.tileCenter(this.tile), plan)
		}
	}
}
