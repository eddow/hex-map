import {
	Color3,
	type Material,
	type Scene,
	ShaderMaterial,
	VertexBuffer,
	type VertexData,
} from '@babylonjs/core'
import { CustomVertexData } from '~/bjs/customVertexData'
import type { Game } from '~/game'
import type { Axial } from '~/utils'
import type { TileBase, WalkTimeSpecification } from '../land'
import type { Sector } from '../sector'
import type { LandscapeTriangle } from './landscape'
import { ContinuousPartialLandscape } from './partialLandscape'
//import type { RiverTile } from './rivers'
//import oceanWgsl from './ocean.wgsl?raw'

export class OceanLandscape<Tile extends TileBase> extends ContinuousPartialLandscape<Tile> {
	protected readonly material: Material
	constructor(
		game: Game,
		private readonly seaLevel: number
	) {
		super(game)
		this.material = oceanMaterial(game.gameView.scene, new Color3(0, 0.2, 1), 0.1)
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
		const vertexData = new CustomVertexData(this.game, { opacity: 1 })
		const tiles = vertex.map((point) => sector.tile(point))
		vertexData.positions = tiles.flatMap(({ position }) => [position.x, this.seaLevel, position.z])
		vertexData.indices = triangles.flatMap(({ points }) => points)
		vertexData.attributes.opacity = tiles.flatMap(
			({ position }) => (this.seaLevel - position.y) / (this.seaLevel * 2)
		)
		return vertexData
	}
	walkTimeMultiplier(movement: WalkTimeSpecification<Tile>): number | undefined {
		if (movement.on.position.y < this.seaLevel) return Number.NaN
	}
}

function oceanMaterial(scene: Scene, color: Color3, shoreOpacity: number): ShaderMaterial {
	const material = new ShaderMaterial(
		'oceanMaterial',
		scene,
		{
			vertexSource: /*wgsl*/ `
uniform mat4 worldViewProjection;
attribute vec3 position;
attribute float opacity;
varying float alpha;

void main() {
	alpha = opacity;
	gl_Position = worldViewProjection * vec4(position, 1.0);
}
			`,
			fragmentSource: /*wgsl*/ `
uniform vec3 color;
uniform float shoreOpacity;
varying float alpha;

void main() {
	// Apply the weights to the colors
	if(alpha < 0.00) discard;
	gl_FragColor = vec4(color, smoothstep(shoreOpacity, 1.0, alpha));
}
			`,
		},
		{
			attributes: [VertexBuffer.PositionKind, 'opacity'],
			uniforms: ['worldViewProjection', 'color', 'shoreOpacity'],
			needAlphaBlending: true,
		}
	)
	material.setColor3('color', color)
	material.setFloat('shoreOpacity', shoreOpacity)
	return material
}
