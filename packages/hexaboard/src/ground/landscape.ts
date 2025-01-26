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
import { assert, complete } from '~/utils/debug'
import { performanceMeasured } from '~/utils/decorators'
import type { Land, LandRenderer, Tile, TileNature } from './land'

export type TileKey = string

export interface TriangleBase {
	side: number
	tilesKey: [TileKey, TileKey, TileKey]
}

export interface TileRenderBase<Triangle extends TriangleBase = TriangleBase> {
	triangles: Set<Triangle>
	// TODO: pos&direction in texture
}

export interface RenderedTile<
	Triangle extends TriangleBase,
	TileRender extends TileRenderBase<Triangle>,
> extends Tile {
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
export type Triplet<T> = [T, T, T]
export interface GeometryBuilder<
	Triangle extends TriangleBase,
	TileRender extends TileRenderBase<Triangle>,
> {
	tileRender?(render: Partial<TileRender>, key: string, nature: TileNature): TileRender
	triangle?(
		triangle: Partial<Triangle>,
		tiles: Triplet<RenderedTile<Triangle, TileRender>>
	): Triangle
	readonly mouseReactive: boolean
	createGeometry(
		tiles: Map<string, RenderedTile<Triangle, TileRender>>,
		triangles: Triangle[]
	): BufferGeometry
	get material(): Material
}

interface GeometryPart<Triangle extends TriangleBase, TileRender extends TileRenderBase<Triangle>> {
	builder: GeometryBuilder<Triangle, TileRender>
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

const nbrInvalidate = 0

export class Landscape<
	Triangle extends TriangleBase = TriangleBase,
	TileRender extends TileRenderBase<Triangle> = TileRenderBase<Triangle>,
> implements LandRenderer, MouseReactive
{
	private readonly geometryParts: GeometryPart<Triangle, TileRender>[]
	public readonly rendered = new Group()
	private vertexKeys: string[] = []
	constructor(
		private readonly land: Land,
		...geometryBuilders: GeometryBuilder<Triangle, TileRender>[]
	) {
		this.geometryParts = geometryBuilders.map((builder) => ({ builder }))
		land.addPart(this)
	}
	get tiles() {
		return this.land.tiles as Map<string, RenderedTile<Triangle, TileRender>>
	}
	mouseHandle(game: Game, intersection: Intersection<Object3D<Object3DEventMap>>): MouseHandle {
		const baryArr = intersection.barycoord!.toArray()
		const facePt = baryArr.indexOf(Math.max(...baryArr))
		const geomPt = intersection.face!['abc'[facePt] as keyof Face] as number
		const tileKey = this.vertexKeys[geomPt]
		return new Tile1GHandle(tileKey, this.tiles.get(tileKey)!)
	}

	protected readonly triangles = new Set<Triangle>()

	@performanceMeasured('add')
	addTiles(added: string[]): void {
		for (const key of added) {
			const tile = this.tiles.get(key)
			if (tile?.nature && !tile.rendered) {
				let rendered: Partial<TileRender> = {}
				rendered.triangles = new Set()
				for (const part of this.geometryParts)
					rendered = part.builder.tileRender?.(rendered, key, tile.nature) ?? rendered
				tile.rendered = rendered as TileRender
				// Here, generate texture specs
				for (const { next, last, side } of tileTriangles(tile.coords)) {
					const nextKey = axial.key(next)
					const lastKey = axial.key(last)
					const nextTile = this.tiles.get(nextKey)
					const lastTile = this.tiles.get(lastKey)
					if (nextTile?.rendered && lastTile?.rendered) {
						let triangle: Partial<Triangle> = {}
						triangle.side = side
						triangle.tilesKey = [key, nextKey, lastKey]
						for (const part of this.geometryParts)
							triangle = part.builder.triangle?.(triangle, [tile, nextTile, lastTile]) ?? triangle
						complete(triangle)
						nextTile.rendered.triangles.add(triangle)
						lastTile.rendered.triangles.add(triangle)
						tile.rendered.triangles.add(triangle)
						this.triangles.add(triangle)
					}
				}
			}
		}
	}

	@performanceMeasured('remove')
	removeTiles(removed: string[]): void {
		for (const key of removed) {
			const tile = this.tiles.get(key)
			if (tile?.rendered) {
				for (const triangle of tile.rendered.triangles) {
					for (const tileKey of triangle.tilesKey) {
						const tile = this.tiles.get(tileKey)
						assert(tile?.rendered, 'Consistency: un-rendered tile was rendered')
						tile.rendered.triangles.delete(triangle)
					}
					this.triangles.delete(triangle)
				}
				tile.rendered = undefined
			}
		}
	}

	@performanceMeasured('render')
	render() {
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
				if (part.builder.mouseReactive) part.mesh.userData = { mouseTarget: this }
				this.rendered.add(part.mesh)
			}
		}
	}

	@performanceMeasured('invalidate')
	invalidate(added: string[], removed: string[]): void {
		// #region add points

		this.addTiles(added)

		// #endregion
		// #region remove points

		this.removeTiles(removed)

		// #endregion
		// #region update geometry

		this.render()

		// #endregion
	}
}
