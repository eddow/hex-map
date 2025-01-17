import type { Group } from 'three'
import type HexPow2Gen from '~/hexagon/pow2gen'
import type HexSector from '~/hexagon/sector'
import type { RandGenerator } from '~/utils/random'
import type { TerrainsDefinition } from './terrain'

export abstract class Land {
	abstract readonly tileSize: number
	progress(dt: number) {}
	/**
	 * Load foundation terrain shape from seed
	 * @param gen
	 */
	abstract generate(gen: RandGenerator): void
	/**
	 * Randomly generate content that will be later saved and restored
	 */
	abstract virgin(): void
	/**
	 * Generate the meshes for all the content
	 */
	abstract mesh(): void
	abstract get group(): Group
	abstract get terrains(): TerrainsDefinition
}

export class MonoSectorLand<Sector extends HexSector = HexSector> extends Land {
	constructor(public readonly sector: Sector) {
		super()
	}
	get tileSize() {
		return this.sector.tileSize
	}
	generate(gen: RandGenerator) {
		this.sector.generate(gen)
	}
	virgin() {
		this.sector.virgin()
	}
	mesh() {
		this.sector.meshTerrain()
		this.sector.meshContent()
	}
	get group() {
		return this.sector.group
	}
	get terrains() {
		return (this.sector as HexSector as HexPow2Gen).terrains
	}
}

/**
 * We can construct a sector with 2 more sides (`puzzleTiles` tiles) so that they can nest into each another in an infinite board
 */
