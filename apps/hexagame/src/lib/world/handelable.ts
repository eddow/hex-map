import { Resource } from 'hexaboard'

export class Tree extends Resource {
	get nbrModels() {
		return 3
	}
	get path() {
		return '/assets/resource/tree#.glb'
	}
}

export class Rock extends Resource {
	get nbrModels() {
		return 3
	}
	get path() {
		return '/assets/resource/rock#.glb'
	}
}
