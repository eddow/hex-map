import type { Triplet } from '~/types'
import { type Axial, type AxialCoord, type AxialKey, AxialKeyMap, LCG, axial } from '~/utils'
import { type FunctionParts, exposeThreadTask, makeFunction } from '~/utils/workers/definition'
import type { TerrainKey } from '../perlinTerrain'
import { centeredTriangles, sectorTriangles } from './landscape'
import type { TileTextureStyle } from './textureLandscape'

export interface TileTextureStyleTransfer {
	weightMix: string
	texturePosition: FunctionParts
}

interface TexturePosition {
	alpha: number
	radius: number
	center: { u: number; v: number }
}
const scSummits: { cos: number; sin: number }[] = []
for (let i = 0; i < 6; i++) {
	scSummits.push({ cos: Math.cos((i * Math.PI) / 3), sin: Math.sin((i * Math.PI) / 3) })
}
// TODO: Now, side is 0 or 1, optimize ?
function textureUVs(
	{ alpha, radius: inTextureRadius, center: { u, v } }: TexturePosition,
	side: 0 | 1,
	rot: 0 | 2 | 4
) {
	const scAlpha = {
		cos: inTextureRadius * Math.cos(alpha),
		sin: inTextureRadius * Math.sin(alpha),
	}
	const rs = rot + side
	const rs1 = (rs + 1) % 6

	// use `cos(a+b)=cos(a)*cos(b)-sin(a)*sin(b)` & `sin(a+b)=sin(a)*cos(b)+cos(a)*sin(b)`
	const bp1u = u + scAlpha.cos * scSummits[rs1].cos - scAlpha.sin * scSummits[rs1].sin
	const bp1v = v + scAlpha.cos * scSummits[rs1].sin + scAlpha.sin * scSummits[rs1].cos
	const bp2u = u + scAlpha.cos * scSummits[rs].cos - scAlpha.sin * scSummits[rs].sin
	const bp2v = v + scAlpha.cos * scSummits[rs].sin + scAlpha.sin * scSummits[rs].cos
	switch (rot) {
		case 0:
			return [u, v, bp1u, bp1v, bp2u, bp2v]
		case 2:
			return [bp1u, bp1v, bp2u, bp2v, u, v]
		case 4:
			return [bp2u, bp2v, u, v, bp1u, bp1v]
		default:
			throw new Error('Invalid rotation value')
	}
}

export type Tiles = [AxialKey, { position: Triplet<number>; terrain: TerrainKey }][]
export type ContinuousTextureLandscapeWorker = typeof workerCreateGeometry
async function workerCreateGeometry(
	tilesArray: Tiles,
	sectorRadius: number,
	sectorCenter: AxialCoord,
	textureStyleTransfer: TileTextureStyleTransfer,
	terrainTypes: Record<TerrainKey, unknown>,
	texturesIndex: Record<TerrainKey, number>
) {
	const triangles = centeredTriangles(sectorTriangles(sectorRadius), sectorCenter)
	const tiles = new AxialKeyMap(tilesArray)
	const textureStyle: TileTextureStyle = {
		weightMix: textureStyleTransfer.weightMix,
		texturePosition: makeFunction<(terrain: unknown, point: Axial) => TexturePosition>(
			textureStyleTransfer.texturePosition
		),
	}
	// Gather the texture positions
	const textureUvCache = new AxialKeyMap(
		(function* () {
			for (const [i, tile] of tiles) {
				const point = axial.keyAccess(i)
				yield [
					i,
					textureStyle.texturePosition(
						terrainTypes[tile.terrain],
						point,
						LCG('seamlessTextureStyle', point.q, point.r)
					),
				]
			}
		})()
	)
	const neighborsMap = new Map<AxialKey, Triplet<number>[]>()
	// Gather the neighbors in order to compute the hexagonal normal in the vertex shader
	/*for (const [i] of sector.tiles.entries()) {
		neighborsMap.set(
			i,
			axial.neighbors(i).map((n) => {
				const { x, y, z } = sector.land.tile(n).position
				return [x, y, z]
			})
		)
	}*/

	const positions = new Float32Array(triangles.length * 3 * 3)
	const textureIdx = new Uint8Array(triangles.length * 3 * 3)
	/*const n1 = new Float32Array(triangles.length * 3 * 3)
		const n2 = new Float32Array(triangles.length * 3 * 3)
		const n3 = new Float32Array(triangles.length * 3 * 3)
		const n4 = new Float32Array(triangles.length * 3 * 3)
		const n5 = new Float32Array(triangles.length * 3 * 3)
		const n6 = new Float32Array(triangles.length * 3 * 3)*/

	const uvA = new Float32Array(triangles.length * 3 * 2)
	const uvB = new Float32Array(triangles.length * 3 * 2)
	const uvC = new Float32Array(triangles.length * 3 * 2)

	let index = 0
	for (const triangle of triangles) {
		// Calculate the 3 terrain textures parameters
		const { points, side } = triangle
		const [A, B, C] = points.map((point) => textureUvCache.get(point)!)
		uvA.set(textureUVs(A, side, 0), index * 2)
		uvB.set(textureUVs(B, side, 4), index * 2)
		uvC.set(textureUVs(C, side, 2), index * 2)
		const textureIndexes = points.map((point) => texturesIndex[tiles.get(point.key)!.terrain])
		for (const point of points) {
			const tile = tiles.get(point.key)!
			const position = tile.position

			// Per vertex
			positions.set(position, index * 3)

			/*const neighbors = neighborsMap.get(point.key)!
				n1.set(neighbors[5], index * 3)
				n2.set(neighbors[4], index * 3)
				n3.set(neighbors[3], index * 3)
				n4.set(neighbors[2], index * 3)
				n5.set(neighbors[1], index * 3)
				n6.set(neighbors[0], index * 3)*/

			// Per triangle
			textureIdx.set(textureIndexes, index * 3)

			index++
		}
	}
	return {
		uvA,
		uvB,
		uvC,
		textureIdx,
		positions,
	}
}

exposeThreadTask(workerCreateGeometry)
