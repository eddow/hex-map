import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from 'three'
import { costingPath } from '~/game'
import { type Axial, type AxialKey, AxialKeyMap, LCG, axial } from '~/utils'
import {
	type Land,
	SectorNotGeneratedError,
	type TileUpdater,
	type WalkTimeSpecification,
} from '../land'
import type { TerrainKey, TerrainTile } from '../perlinTerrain'
import type { Sector } from '../sector'
import type { LandscapeTriangle } from './landscape'
import { ContinuousPartialLandscape } from './partialLandscape'

// TODO: avoid ending in a puddle

export interface RiverTile extends TerrainTile {
	riverHeight?: number
	originalZ?: number
}

let [minRiverHeight, maxRiverHeight] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

const riverMaterial = new ShaderMaterial({
	transparent: true,
	uniforms: {
		shoreOpacity: { value: 0.1 },
	},
	vertexShader: `
attribute float opacity;
attribute vec3 color;
varying float alpha;
varying vec3 vColor;

void main() {
	alpha = opacity;
	vColor = color;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
				`,
	fragmentShader: `
uniform float shoreOpacity;
varying float alpha;
varying vec3 vColor;

void main() {

	// Apply the weights to the colors
	if(alpha < 0.00) discard;
	gl_FragColor = vec4(vColor, clamp(shoreOpacity + alpha * (1.0-shoreOpacity), shoreOpacity, 1.0));
}
						`,
})

export type RivesOptions = {
	riverTerrain: TerrainKey
	minLength: number
	/**
	 * Minimum slope in world' unit of the bank
	 */
	minBankSlope: number
	minStreamSlope: number
}
// TODO: become a partialLandscape
export class Rivers<Tile extends RiverTile = RiverTile> extends ContinuousPartialLandscape<Tile> {
	options: RivesOptions
	protected readonly material = riverMaterial
	private sources: AxialKeyMap<Tile> = new AxialKeyMap()
	constructor(
		private readonly land: Land<Tile>,
		private readonly seed: number,
		private readonly seaLevel: number,
		private readonly terrainHeight: number,
		private readonly maxAxialDistance: number,
		private readonly sourcesPerTile: number,
		{
			riverTerrain = 'river',
			minLength = 3,
			minBankSlope = 2,
			minStreamSlope = 1,
		}: Partial<RivesOptions> = {}
	) {
		super(land.sectorRadius)
		this.options = { riverTerrain, minLength, minBankSlope, minStreamSlope }
	}
	refineTile(tile: Tile, coord: Axial): undefined {
		// Avoids sources being neighbors
		if (tile.position.z < this.seaLevel || ((coord.q | coord.r) & 1) !== 0) return
		const gen = LCG(this.seed, 'rivers', coord.q, coord.r)
		if (
			gen() <
			(this.sourcesPerTile * (tile.position.z - this.seaLevel)) /
				(this.terrainHeight - this.seaLevel)
		)
			this.sources.set(coord, tile)
	}

	spreadGeneration(updateTile: TileUpdater<Tile>): void {
		const Z = (tile: Tile) => tile.originalZ ?? tile.position.z
		const { sources } = this
		this.sources = new AxialKeyMap()
		for (const [sourceKey, tile] of sources)
			if (tile.sectors.length)
				try {
					const source = axial.keyAccess(sourceKey)
					const path = costingPath(
						source,
						(from, to) => {
							if (axial.distance(to, source) > this.maxAxialDistance) return Number.NaN
							const [tFrom, tTo] = [this.land.tile(from), this.land.tile(to)]
							// 2 facts are costly:
							return (
								// the fact to get upward
								Math.max(0, Z(tTo) - Z(tFrom)) ** 2 +
								// The fact to not take the strongest down slope
								Z(tTo) -
								Math.min(...axial.neighbors(from).map((p) => Z(this.land.tile(p))))
							)
						},
						(aRef) => {
							const tile = this.land.tile(aRef)
							return Z(tile) < this.seaLevel //|| tile.terrain === this.options.riverTerrain
						}
					)
					const sourceSectors = this.land.tile(source).sectors as Sector<Tile>[]

					// Remove the end of river who enters too much in the sea
					while (path && path.length > this.options.minLength) {
						const last = path[path.length - 1]
						const oceanNeighbors = axial
							.neighbors(last)
							.reduce(
								(nbr, tile) => nbr + (this.land.tile(tile).position.z < this.seaLevel ? 1 : 0),
								0
							)
						if (oceanNeighbors < 4) break
						path.pop()
					}
					if (path && path.length > this.options.minLength) {
						// Last tile in the path
						const ultimatePosition = this.land.tile(path[path.length - 1]).position
						// Last processed tile
						let lastTile = this.land.tile(source)
						let lastPoint: Axial = axial.coordAccess(source)
						if (!lastTile.riverHeight || lastTile.riverHeight !== lastTile.position.z)
							updateTile([], source, {
								terrain: this.options.riverTerrain,
								riverHeight: lastTile.position.z,
							} as Partial<Tile>)
						const bank = new Set<AxialKey>()
						for (let step = 1; step < path.length; step++) {
							const point = path[step]!
							const tile = this.land.tile(point)
							if (tile.originalZ === undefined) tile.originalZ = tile.position.z
							const tileNeighbors = axial
								.neighbors(point)
								.map((c) => axial.coordAccess(c))
								.filter((p) => ![path[step + 1]?.key, lastPoint.key].includes(p.key))

							for (const neighbor of tileNeighbors) bank.add(neighbor.key)
							const minNeighborZ = Math.min(
								...tileNeighbors.map((key) => this.land.tile(key).position.z)
							)

							// enforce minimum slope
							const z = Math.min(
								tile.position.z,
								// bank slope
								minNeighborZ - this.options.minBankSlope,
								// 0.8: minimum slope to have (1 = never change the slope)
								lastTile.position.z +
									(ultimatePosition.z - lastTile.position.z) / (path.length - step),
								// absolute stream slope
								lastTile.position.z - this.options.minStreamSlope
							)
							const riverHeight = Math.max(
								this.seaLevel,
								Math.min(minNeighborZ - this.options.minBankSlope / 3, lastTile.riverHeight!)
							)
							if (riverHeight < minRiverHeight) minRiverHeight = riverHeight
							if (riverHeight > maxRiverHeight) maxRiverHeight = riverHeight
							if (!tile.riverHeight || tile.riverHeight !== riverHeight || tile.position.z !== z)
								updateTile(sourceSectors, point, {
									terrain: this.options.riverTerrain,
									riverHeight,
									position: { ...tile.position, z },
								} as Partial<Tile>)

							lastTile = tile
							lastPoint = point
						}
						for (const key of bank) {
							const tile = this.land.tile(key)
							const river = axial
								.neighbors(key)
								.map((p) => this.land.tile(p))
								.filter((t) => t.terrain === this.options.riverTerrain)
								.map((t) => t.riverHeight!)
							const riverHeight = river.reduce((a, b) => a + b, 0) / river.length
							if (!tile.riverHeight || tile.riverHeight < riverHeight) {
								updateTile(sourceSectors, key, {
									riverHeight,
								} as Partial<Tile>)
							}
						}
					}
				} catch (e) {
					if (e instanceof SectorNotGeneratedError) this.sources.set(sourceKey, tile)
					else throw e
				}
	}
	filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean {
		const seaLevel = this.seaLevel
		return (triangle) => {
			const triangleTiles = triangle.points.map((point) => sector.tiles.get(point)!)
			const nbrRiverHeights = triangleTiles.reduce(
				(nbr, tile) => nbr + (tile.riverHeight !== undefined ? 1 : 0),
				0
			)
			const nbrOcean = triangleTiles.reduce(
				(nbr, tile) => nbr + ((tile.originalZ ?? tile.position.z) < seaLevel ? 1 : 0),
				0
			)
			return nbrRiverHeights === 3 || (nbrRiverHeights > 0 && nbrOcean > 0)
			//if (nbrRiverHeights < 3 && (nbrRiverHeights < 1 || nbrOcean < 1)) continue
		}
	}
	async createPartialGeometry(sector: Sector<Tile>, triangles: LandscapeTriangle[]) {
		const positions: number[] = []
		const opacities: number[] = []
		const colors: number[] = []
		const indices: number[] = []
		const tileIndices = new Map<RiverTile, number>()
		const seaLevel = this.seaLevel
		for (const triangle of triangles) {
			const triangleTiles = triangle.points.map((point) => sector.tiles.get(point)!)
			for (const tile of triangleTiles) {
				let tileVertex = tileIndices.get(tile)
				if (tileVertex === undefined) {
					tileVertex = tileIndices.size
					tileIndices.set(tile, tileVertex)
					const { x, y, z } = tile.position
					const riverHeight = tile.riverHeight ?? seaLevel
					// TODO: 20? 40?
					const opacity =
						(tile.originalZ ?? z) < seaLevel
							? (seaLevel - z) / (seaLevel * 2)
							: (riverHeight - z) / 80
					positions.push(x, y, riverHeight)
					opacities.push(opacity)
					/*if (tile.riverHeight !== undefined) colors.push(0.05, 0.2, 0.95)
					else*/ colors.push(0.0, 0.2, 1)
				}
				indices.push(tileVertex)
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('opacity', new Float32BufferAttribute(opacities, 1))
		geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
		geometry.setIndex(indices)
		return geometry
	}
	walkTimeMultiplier(movement: WalkTimeSpecification<RiverTile>): number | undefined {
		if (movement.on.terrain === this.options.riverTerrain) return Number.NaN
	}
}
