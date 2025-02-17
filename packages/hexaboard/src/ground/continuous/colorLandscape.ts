import { Color3, type Material, StandardMaterial, VertexData } from '@babylonjs/core'
import type { Game } from '~/game'
import type { Axial, AxialCoord } from '~/utils'
import type { TileBase } from '../land'
import type { Sector } from '../sector'
import { CompleteLandscape } from './completeLandscape'
import type { LandscapeTriangle } from './landscape'

export interface ColorTile extends TileBase {
	color: Color3
}

export class ContinuousColorLandscape<
	Tile extends ColorTile = ColorTile,
> extends CompleteLandscape<Tile> {
	protected readonly material: Material
	constructor(game: Game) {
		super(game)
		const material = new StandardMaterial('vertexColorMaterial', game.gameView.scene)
		material.wireframe = true
		material.disableLighting = true
		material.emissiveColor = new Color3(1, 1, 1)
		this.material = material
	}
	async createVertexData(
		sector: Sector<Tile>,
		triangles: LandscapeTriangle<number>[],
		vertex: Axial[]
	): Promise<VertexData> {
		const vertexData = new VertexData()
		const tiles = vertex.map((point) => sector.tile(point))
		vertexData.positions = tiles.flatMap(({ position }) => [position.x, position.y, position.z])
		vertexData.colors = tiles.flatMap(({ color }) => [color.r ?? 0, color.g ?? 0, color.b ?? 0, 1])
		vertexData.indices = triangles.flatMap(({ points }) => points)
		return vertexData
	}
	refineTile(tile: TileBase, coord: AxialCoord): Tile {
		const h01 = Math.min(1, Math.max(0, tile.position.y / 150))
		return {
			...tile,
			color: {
				g: h01,
				b: 1 - h01,
			},
		} as Tile
	}
}
