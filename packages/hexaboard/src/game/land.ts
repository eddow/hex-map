import type { Group } from 'three'
import type HexPow2Gen from '~/hexagon/pow2gen'
import type HexSector from '~/sector/sector'
import type { RandGenerator } from '~/utils/misc'
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
		//REM this.sector.meshContent()
	}
	get group() {
		return this.sector.group
	}
	get terrains() {
		return (this.sector as HexSector as HexPow2Gen).terrains
	}
}
