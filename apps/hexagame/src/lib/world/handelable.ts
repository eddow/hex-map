import { Resource } from 'hexaboard'

export class Tree extends Resource {
	get models() {
		return 3
	}
	get path() {
		return '/assets/resource/tree#.glb'
	}
}

export class Rock extends Resource {
	get models() {
		return 3
	}
	get path() {
		return '/assets/resource/rock#.glb'
	}
}
