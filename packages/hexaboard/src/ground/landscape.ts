import {
	type BufferGeometry,
	type Face,
	Group,
	type Intersection,
	type Material,
	Mesh,
	type Object3D,
	type Object3DEventMap,
} from 'three'
import type { Game } from '~/game/game'
import { MouseHandle, type MouseReactive } from '~/utils'
import { type AxialRef, axial, hexSides } from '~/utils/axial'
import { assert } from '~/utils/debug'
import type { LandRenderer, Tile } from './land'

export type TileKey = string

export interface RenderedTriangle {
	side: number
	tilesKey: [TileKey, TileKey, TileKey]
}

export interface TileRenderBase {
	triangles: Set<RenderedTriangle>
	// TODO: pos&direction in texture
}

export interface RenderedTile<TileRender extends TileRenderBase = TileRenderBase> extends Tile {
	rendered?: TileRender
}

function* tileTriangles(ref: AxialRef) {
	let last = axial.linear(ref, hexSides[5])
	for (let side = 0; side < 6; side++) {
		const hexSide = hexSides[side]
		const next = axial.linear(ref, hexSide)
		yield { next, last, side }
		last = next
	}
}

export interface GeometryBuilder<TileRender extends TileRenderBase = TileRenderBase> {
	tileRender(tile: Partial<TileRender>, key: string): TileRender
	createGeometry(
		tiles: Map<string, RenderedTile<TileRender>>,
		triangles: RenderedTriangle[]
	): BufferGeometry
	get material(): Material
}

interface GeometryPart<TileRender extends TileRenderBase> {
	builder: GeometryBuilder<TileRender>
	mesh?: Mesh
	material?: Material
}

export class Tile1GHandle extends MouseHandle {
	constructor(
		public readonly aKey: TileKey,
		public readonly tile: Tile
	) {
		super()
	}
	equals(other: Tile1GHandle): boolean {
		return this.aKey === other.aKey
	}
}

export class Landscape<TileRender extends TileRenderBase = TileRenderBase>
	implements LandRenderer, MouseReactive
{
	private readonly geometryParts: GeometryPart<TileRender>[]
	public readonly group = new Group()
	private vertexKeys: string[] = []
	constructor(
		private readonly tiles: Map<string, RenderedTile<TileRender>>,
		...geometryBuilders: GeometryBuilder<TileRender>[]
	) {
		this.geometryParts = geometryBuilders.map((builder) => ({ builder }))
	}
	mouseHandle(game: Game, intersection: Intersection<Object3D<Object3DEventMap>>): MouseHandle {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileKey = this.vertexKeys[geomPt]
		return new Tile1GHandle(tileKey, this.tiles.get(tileKey)!)
	}

	protected readonly triangles = new Set<RenderedTriangle>()

	get rendered() {
		return this.group
	}

	invalidate(added: string[], removed: string[]): void {
		// #region add points

		for (const key of added) {
			const tile = this.tiles.get(key)
			if (tile?.nature && !tile.rendered) {
				let rendered: Partial<TileRender> = {}
				rendered.triangles = new Set()
				for (const part of this.geometryParts) rendered = part.builder.tileRender(rendered, key)
				tile.rendered = rendered as TileRender
				// Here, generate texture specs
				for (const { next, last, side } of tileTriangles(axial.coords(key))) {
					const nextKey = axial.key(next)
					const lastKey = axial.key(last)
					const nextTile = this.tiles.get(nextKey)
					const lastTile = this.tiles.get(lastKey)
					if (nextTile?.rendered && lastTile?.rendered) {
						const triangle: RenderedTriangle = { side, tilesKey: [key, nextKey, lastKey] }
						nextTile.rendered.triangles.add(triangle)
						lastTile.rendered.triangles.add(triangle)
						tile.rendered.triangles.add(triangle)
						this.triangles.add(triangle)
					}
				}
			}
		}

		// #endregion
		// #region remove points

		for (const key of removed) {
			const tile = this.tiles.get(key)
			if (tile?.rendered)
				for (const triangle of tile.rendered.triangles) {
					for (const tileKey of triangle.tilesKey) {
						const tile = this.tiles.get(tileKey)
						assert(tile?.rendered, 'Consistency: un-rendered tile was rendered')
						tile.rendered.triangles.delete(triangle)
						if (!tile.rendered.triangles.size) tile.rendered = undefined
					}
					this.triangles.delete(triangle)
				}
		}

		// #endregion
		// #region update geometry
		const triangles = Array.from(this.triangles)
		this.vertexKeys = []
		for (const triangle of triangles) this.vertexKeys.push(...triangle.tilesKey)
		for (const part of this.geometryParts) {
			const geometry = part.builder.createGeometry(this.tiles, triangles)
			if (part.mesh) {
				const mesh = part.mesh
				mesh.geometry.dispose()
				mesh.geometry = geometry
				geometry.computeBoundingBox()
				geometry.computeBoundingSphere()
			} else {
				part.mesh = new Mesh(geometry, part.builder.material)
				part.mesh.userData = { mouseTarget: this }
				this.group.add(part.mesh)
			}
		}

		// #endregion
	}
}
