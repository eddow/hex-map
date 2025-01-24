import { Group } from 'three'
import type { Resource, ResourcefulTerrain } from '~/game/handelable'
import { type AxialRef, LCG, type RandGenerator, axial, genTilePosition } from '~/utils'
import type { TileBase } from '../sector'
import type Sector from '../sector'
import type { LandInit } from './land'
import { PuzzleLand } from './puzzle'

// Hardcoded to have 7 (center + 6 sides) places for stuff (resources, supplies, ...) roughly placed at the same place
const placesInTile = 7
function placeInTile(i: number, aRef: AxialRef, radius: number) {
	const gen = LCG('placeInTile', axial.index(aRef), i)
	// triangle part: the center has the same area than the outside trapezoids
	const tp = Math.sqrt(2) / 2
	if (i === 0) {
		// Center
		return genTilePosition(gen, radius * tp)
	}
	const t = gen(tp, 1 - tp)
	const u = gen(t)
	return {
		s: i - 1,
		u: u * radius,
		v: (1 - u) * radius,
	}
}

interface ResourceOccupation {
	resources: (Resource | undefined)[]
	group?: Group
	// Some tiles are shared between sectors
	usedBy: Sector[]
	dirty: boolean
}

export type ResourceGenerator = new (gen: RandGenerator, terrain: ResourcefulTerrain) => Resource
export type ResourceDistribution = [typeof Resource, number]
function generateResource(gen: RandGenerator, terrain: ResourcefulTerrain) {
	const resources = terrain.resourceDistribution
	if (!resources.length) return
	let choice = gen()
	for (let [resource, chance] of resources) {
		chance /= placesInTile
		if (choice < chance) return new resource(gen, terrain)
		choice -= chance
	}
}
function* generateResources(gen: RandGenerator, terrain: ResourcefulTerrain) {
	const resources = terrain.resourceDistribution
	if (!resources.length) return
	for (let i = 0; i < placesInTile; i++) yield generateResource(gen, terrain)
}

export type ResourcefulInit<
	Terrain extends ResourcefulTerrain = ResourcefulTerrain,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> = LandInit<Terrain, Tile> & {
	/**
	 * Specifies the amount of rings *in* the tile. These are the divisions with points where resources can appear
	 */
	tileRadius: number
	seaLevel: number
}

export class ResourcefulLand<
	Terrain extends ResourcefulTerrain = ResourcefulTerrain,
	Tile extends TileBase<Terrain> = TileBase<Terrain>,
> extends PuzzleLand<Terrain, Tile> {
	readonly tileRadius: number
	readonly seaLevel: number
	resourcesGroup = new Group()
	constructor(init: ResourcefulInit<Terrain, Tile>) {
		super(init)
		this.tileRadius = init.tileRadius
		this.seaLevel = init.seaLevel
		this.group.add(this.resourcesGroup)
	}
	resourceTiles: Record<string, ResourceOccupation> = {}
	addedSector(sector: Sector<Tile>): void {
		super.addedSector(sector)

		for (const hexIndex in sector.tiles) {
			const worldCoords = sector.worldTile(+hexIndex)
			const worldKey = axial.key(worldCoords)
			const gen = sector.tileGen(+hexIndex, 'resources')
			const tile = sector.tiles[hexIndex]
			let rscTile = this.resourceTiles[worldKey]
			if (!rscTile) {
				const resources =
					tile.z > this.seaLevel ? Array.from(generateResources(gen, tile.terrain)) : []
				rscTile = this.resourceTiles[worldKey] = { resources, dirty: false, usedBy: [sector] }
			} else if (!rscTile.usedBy.includes(sector)) rscTile.usedBy.push(sector)
			this.reMesh(sector, +hexIndex, rscTile)
		}
	}
	reMesh(sector: Sector<Tile>, aRef: AxialRef, tile: ResourceOccupation): void {
		if (tile.resources.some((r) => r)) {
			if (!tile.group) {
				tile.group = new Group()
				tile.group.position.copy(sector.tileCenter(aRef))
				this.resourcesGroup.add(tile.group)
			}
			for (let i = 0; i < tile.resources.length; i++) {
				const rsc = tile.resources[i]
				if (rsc) {
					const pos = this.landscape.cartesian(sector, aRef, placeInTile(i, aRef, this.tileRadius))
					if (pos && !rsc.builtMesh) {
						const mesh = rsc.createMesh()
						mesh.position.copy(pos)
						tile.group.add(mesh)
					}
				}
			}
		}
	}

	removeSector(sector: Sector): void {
		const tiles = this.resourceTiles
		for (const hexIndex in sector.tiles) {
			const worldCoords = sector.worldTile(+hexIndex)
			const worldKey = axial.key(worldCoords)
			const tile = tiles[worldKey]
			if (tiles[worldKey]) {
				const index = tiles[worldKey].usedBy.indexOf(sector)
				if (index !== -1) tiles[worldKey].usedBy.splice(index, 1)
				if (tiles[worldKey].usedBy.length === 0) {
					if (tile.group) this.resourcesGroup.remove(tile.group)
					if (tiles[worldKey].dirty) tile.group = undefined
					else delete tiles[worldKey]
				}
			}
		}
		super.removeSector(sector)
	}
}
