import { Group, type Object3D } from 'three'
import { Handelable, type ResourcefulTerrain } from '~/game'
import { Eventful, LCG, type RandGenerator, genTilePosition } from '~/utils'
import type { LandPart, RenderedEvent } from './land'
import type { Sector } from './sector'
import type { TerrainDefinition, TerrainTile } from './terrain'

// Hardcoded to have 7 (center + 6 sides) places for stuff (resources, supplies, ...) roughly placed at the same place
const placesInTile = 7
function placeInTile(i: number, gen: RandGenerator) {
	// triangle part: the center has the same area than the outside trapezoids
	const tp = Math.sqrt(2) / 2
	if (i === 0) {
		// Center
		return genTilePosition(gen, tp)
	}
	const t = gen(tp, 1 - tp)
	const u = gen(t)
	return {
		s: i - 1,
		u,
		v: 1 - u,
	}
}

export interface TileContent {
	readonly mesh?: Object3D
	readonly walkTimeMultiplier: number
}

export interface ContentTile extends TerrainTile {
	content?: (TileContent | undefined)[]
}

function generateResource(gen: RandGenerator, terrain: ResourcefulTerrain) {
	const distribution = terrain.resourceDistribution
	if (!distribution.length) return
	let choice = gen()
	for (let [resource, chance] of distribution) {
		chance /= placesInTile
		if (choice < chance) return new resource(gen, terrain)
		choice -= chance
	}
}
export class Resourceful<
		Tile extends ContentTile = ContentTile,
		Terrain extends ResourcefulTerrain = ResourcefulTerrain,
	>
	extends Eventful<RenderedEvent<Tile>>
	implements LandPart<Tile>
{
	constructor(
		private readonly terrainDefinition: TerrainDefinition<Terrain>,
		private readonly seed: number,
		private readonly seaLevel: number
	) {
		super()
	}

	*generateResources(gen: RandGenerator, terrain: ResourcefulTerrain) {
		if (!terrain.resourceDistribution.length) return
		for (let i = 0; i < placesInTile; i++) yield generateResource(gen, terrain)
	}

	renderSector(sector: Sector<Tile>): void {
		const group = new Group()
		sector.add(this, group)
		for (const [tRef, tile] of sector.tiles.entries()) {
			// Resource content is generated in the `render` phase so that the terrain is completely generated for sure
			tile.content ??=
				tile.position.z > this.seaLevel
					? Array.from(
							this.generateResources(
								LCG(this.seed, 'resourceful', tile.position.x, tile.position.y),
								this.terrainDefinition.types[tile.terrain]
							)
						)
					: []
			if (tile.content.some((r) => r)) {
				const gen = LCG(this.seed, 'placeInTile', tRef)
				for (let aRef = 0; aRef < tile.content.length; aRef++) {
					const rsc = tile.content[aRef]
					if (rsc instanceof Handelable) {
						const pos = sector.inTile(tRef, placeInTile(aRef, gen))
						if (pos && !rsc.builtMesh) {
							const mesh = rsc.mesh
							mesh.position.copy(pos)
							group.add(mesh)
						}
					}
				}
			}
		}
	}
}
