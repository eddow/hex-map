import { Group } from 'three'
import type { Handelable, ResourcefulTerrain } from '~/game'
import { type Axial, LCG, type RandGenerator, axial, genTilePosition } from '~/utils'
import type { Land, LandPart, Sector } from './land'
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

export interface ContentTile extends TerrainTile {
	content: (Handelable | undefined)[]
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
> implements LandPart<ContentTile>
{
	constructor(
		land: Land<ContentTile>,
		private readonly terrainDefinition: TerrainDefinition<Terrain>,
		private readonly seed: number,
		private readonly seaLevel: number
	) {
		land.addPart(this)
	}

	*generateResources(gen: RandGenerator, terrain: ResourcefulTerrain) {
		if (!terrain.resourceDistribution.length) return
		for (let i = 0; i < placesInTile; i++) yield generateResource(gen, terrain)
	}

	refineTile(tile: TerrainTile, coords: Axial): ContentTile | undefined {
		const terrain = this.terrainDefinition.types[tile.terrain]
		return {
			...tile,
			content:
				tile.position.z > this.seaLevel
					? Array.from(
							this.generateResources(LCG(this.seed, 'resourceful', coords.q, coords.r), terrain)
						)
					: [],
		}
	}

	renderSector(sector: Sector<Tile>, tiles: Tile[]): void {
		const group = new Group()
		sector.group.add(group)
		for (let tRef = 0; tRef < tiles.length; tRef++) {
			const tile = tiles[tRef]
			if (tile.content.some((r) => r)) {
				const worldCoords = axial.linear(axial.coords(tRef), sector.center)
				const gen = LCG(this.seed, 'placeInTile', worldCoords.q, worldCoords.r)
				for (let aRef = 0; aRef < tile.content.length; aRef++) {
					const rsc = tile.content[aRef]
					if (rsc) {
						const pos = sector.inTile(tiles, tRef, placeInTile(aRef, gen))
						if (pos && !rsc.builtMesh) {
							const mesh = rsc.createMesh()
							mesh.position.copy(pos)
							group.add(mesh)
						}
					}
				}
			}
		}
	}
}
