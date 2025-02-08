import { type PawnType, pawnHealth } from './constants'

export class SquadMember {
	constructor(public squad: Squad) {}
}

export class Squad {
	constructor(
		public readonly type: PawnType,
		public stamina = pawnHealth
	) {}
}
