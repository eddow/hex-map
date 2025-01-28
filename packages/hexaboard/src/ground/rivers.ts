import { BufferGeometry, Float32BufferAttribute, Mesh, type Object3D, ShaderMaterial } from 'three'
import { costingPath } from '~/game'
import { type Axial, type AxialKey, LCG, axial, neighbors } from '~/utils'
import type { Land, Sector, TileUpdater } from './land'
import type { Landscape, LandscapeTriangle } from './landscaper'
import type { TerrainKey, TerrainTile } from './terrain'

// TODO: avoid ending in a puddle
type Sources = Axial[]

export interface RiverTile extends TerrainTile {
	riverHeight?: number
	originalZ?: number
}

let [minRiverHeight, maxRiverHeight] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

export type RivesOptions = {
	riverTerrain: TerrainKey
	minLength: number
	/**
	 * Minimum slope in world' unit of the bank
	 */
	minBankSlope: number
	minStreamSlope: number
}

export class Rivers<Tile extends RiverTile = RiverTile> implements Landscape<Tile, Sources> {
	options: RivesOptions
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
			minBankSlope = 4,
			minStreamSlope = 2,
		}: Partial<RivesOptions> = {}
	) {
		this.options = { riverTerrain, minLength, minBankSlope, minStreamSlope }
	}
	readonly mouseReactive = false
	beginGeneration() {
		return []
	}
	refineTile(tile: Tile, coords: Axial, sources: Sources): undefined {
		if (tile.position.z < this.seaLevel) return
		const gen = LCG(this.seed, 'rivers', coords.q, coords.r)
		if (
			gen() <
			(this.sourcesPerTile * (tile.position.z - this.seaLevel)) /
				(this.terrainHeight - this.seaLevel)
		)
			sources.push(coords)
	}

	spreadGeneration(updateTile: TileUpdater<Tile>, sources: Sources): void {
		const Z = (tile: Tile) => tile.originalZ ?? tile.position.z
		for (const source of sources) {
			const path = costingPath(
				source,
				(from, to) => {
					const toCoords = axial.coords(to)
					if (axial.distance(toCoords, source) > this.maxAxialDistance) return Number.NaN
					const [tFrom, tTo] = [this.land.getTile(from), this.land.getTile(to)]
					// 2 facts are costly:
					return (
						// the fact to get upward
						Math.max(0, Z(tTo) - Z(tFrom)) ** 2 +
						// The fact to not take the strongest down slope
						Z(tTo) -
						Math.min(...neighbors(from).map((p) => Z(this.land.getTile(p))))
					)
				},
				(aRef) => {
					const tile = this.land.getTile(aRef)
					return Z(tile) < this.seaLevel //|| tile.terrain === this.options.riverTerrain
				}
			)
			const sourceSectors = this.land.getTile(source).sectors as Sector<Tile>[]
			// TODO: path.pop when penult has enough ocean neighbors
			if (path && path.length > 3) {
				path.shift() //source
				// Last tile in the path
				const ultimatePosition = this.land.getTile(path[path.length - 1]).position
				// Last processed tile
				let lastTile = this.land.getTile(source)
				let lastTileKey = axial.key(source)
				updateTile([], source, {
					terrain: this.options.riverTerrain,
					riverHeight: lastTile.position.z,
				} as Partial<Tile>)
				//ignore the one in the sea but have it here as "next" is used
				//path.pop()
				const bank = new Set<AxialKey>()
				while (path.length > 0) {
					const tileKey = path.shift()!
					const tile = this.land.getTile(tileKey)
					if (tile.originalZ === undefined) tile.originalZ = tile.position.z
					const tileNeighborsKeys = neighbors(tileKey)
						.map((c) => axial.key(c))
						.filter((p) => ![path[0], lastTileKey].includes(p))

					for (const neighborKey of tileNeighborsKeys) bank.add(neighborKey)
					const minNeighborZ = Math.min(
						...tileNeighborsKeys.map((key) => this.land.getTile(key).position.z)
					)

					// enforce minimum slope
					const z = Math.min(
						tile.position.z,
						// bank slope
						minNeighborZ - this.options.minBankSlope,
						// 0.8: minimum slope to have (1 = never change the slope)
						lastTile.position.z + (ultimatePosition.z - lastTile.position.z) / (path.length + 1),
						// absolute stream slope
						lastTile.position.z - this.options.minStreamSlope
					)
					const riverHeight = Math.max(
						this.seaLevel,
						Math.min(minNeighborZ - this.options.minBankSlope / 3, lastTile.riverHeight!)
					)
					if (riverHeight < minRiverHeight) minRiverHeight = riverHeight
					if (riverHeight > maxRiverHeight) maxRiverHeight = riverHeight
					updateTile(sourceSectors, tileKey, {
						terrain: this.options.riverTerrain,
						riverHeight,
						position: { ...tile.position, z },
					} as Partial<Tile>)

					lastTile = tile
					lastTileKey = tileKey
				}
				for (const key of bank) {
					const tile = this.land.getTile(key)
					const river = neighbors(key)
						.map((p) => this.land.getTile(p))
						.filter((t) => t.terrain === this.options.riverTerrain)
						.map((t) => t.riverHeight!)
					updateTile(sourceSectors, key, {
						riverHeight: river.reduce((a, b) => a + b, 0) / river.length,
					} as Partial<Tile>)
				}
			}
		}
	}
	createMesh(sector: Sector<Tile>, triangles: LandscapeTriangle[]): Object3D {
		const positions: number[] = []
		const opacities: number[] = []
		const colors: number[] = []
		const indices: number[] = []
		const tileIndices = new Map<RiverTile, number>()
		const seaLevel = this.seaLevel
		for (const triangle of triangles) {
			const { indexes } = triangle
			const triangleTiles = indexes.map((tileIndex) => sector.tiles[tileIndex])
			const nbrRiverHeights = triangleTiles.reduce(
				(nbr, tile) => nbr + (tile.riverHeight !== undefined ? 1 : 0),
				0
			)
			const nbrOcean = triangleTiles.reduce(
				(nbr, tile) => nbr + (tile.position.z < seaLevel ? 1 : 0),
				0
			)
			if (nbrRiverHeights < 3 && (nbrRiverHeights < 1 || nbrOcean < 1)) continue
			for (const tile of triangleTiles) {
				let tileVertex = tileIndices.get(tile)
				if (tileVertex === undefined) {
					tileVertex = tileIndices.size
					tileIndices.set(tile, tileVertex)
					const { x, y, z } = tile.position
					const riverHeight = tile.riverHeight ?? seaLevel
					// TODO: 20? 40?
					const opacity = z < seaLevel ? (seaLevel - z) / (seaLevel * 2) : (riverHeight - z) / 40
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
		return new Mesh(geometry, riverMaterial)
	}
}

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
	gl_FragColor = vec4(vColor, 1);//clamp(shoreOpacity + alpha * (1.0-shoreOpacity), shoreOpacity, 1.0));
}
						`,
})
