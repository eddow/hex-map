import { Color3, type Material, StandardMaterial, VertexData } from '@babylonjs/core'
import { ShaderMaterial } from 'three'
import type { Game } from '~/game'
import type { Axial } from '~/utils'
import type { TileBase, WalkTimeSpecification } from '../land'
import type { Sector } from '../sector'
import type { LandscapeTriangle } from './landscape'
import { ContinuousPartialLandscape } from './partialLandscape'
//import type { RiverTile } from './rivers'

const oceanMaterial = new ShaderMaterial({
	transparent: true,
	uniforms: {
		color: { value: [0, 0.2, 1] },
		shoreOpacity: { value: 0.1 },
	},
	vertexShader: `
attribute float opacity;
varying float alpha;

void main() {
	alpha = opacity;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
				`,
	fragmentShader: `
uniform vec3 color;
uniform float shoreOpacity;
varying float alpha;

void main() {

	// Apply the weights to the colors
	if(alpha < 0.00) discard;
	gl_FragColor = vec4(color, clamp(shoreOpacity + alpha * (1.0-shoreOpacity), shoreOpacity, 1.0));
}
						`,
})

// TODO: become a partialLandscape
export class OceanLandscape<Tile extends TileBase> extends ContinuousPartialLandscape<Tile> {
	protected readonly material: Material
	constructor(
		game: Game,
		private readonly seaLevel: number
	) {
		super(game)
		const material = new StandardMaterial('vertexColorMaterial', game.gameView.scene)
		material.disableLighting = true
		material.emissiveColor = new Color3(0, 0, 1)
		material.alpha = 0.5
		this.material = material
	}
	filterTriangles(sector: Sector<Tile>): (triangle: LandscapeTriangle) => boolean {
		const seaLevel = this.seaLevel
		return (triangle) => {
			const triangleTiles = triangle.points.map((point) => sector.tiles.get(point)!)
			return triangleTiles.some((tile) => tile.position.y < seaLevel) /*&&
				triangleTiles.every((tile) => tile.riverHeight === undefined)*/
		}
	}
	protected async createVertexData(
		sector: Sector<Tile>,
		triangles: LandscapeTriangle<number>[],
		vertex: Axial[]
	): Promise<VertexData> {
		const vertexData = new VertexData()
		const tiles = vertex.map((point) => sector.tile(point))
		vertexData.positions = tiles.flatMap(({ position }) => [position.x, this.seaLevel, position.z])
		vertexData.indices = triangles.flatMap(({ points }) => points)
		return vertexData
		/*
		const positions: number[] = []
		const opacities: number[] = []
		const indices: number[] = []
		const tileIndices = new Map<Tile, number>()
		const seaLevel = this.seaLevel
		for (const triangle of triangles) {
			const triangleTiles = triangle.points.map((coord) => sector.tiles.get(coord)!)
			for (const tile of triangleTiles) {
				let tileVertex = tileIndices.get(tile)
				if (tileVertex === undefined) {
					tileVertex = tileIndices.size
					tileIndices.set(tile, tileVertex)

					const { x, y, z } = tile.position
					const opacity = (seaLevel - z) / (seaLevel * 2)
					positions.push(x, y, seaLevel)
					opacities.push(opacity)
				}
				indices.push(tileVertex)
			}
		}
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('opacity', new Float32BufferAttribute(opacities, 1))
		geometry.setIndex(indices)
		return geometry*/
	}
	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number | undefined {
		if (movement.on.position.y < this.seaLevel) return Number.NaN
	}
}
