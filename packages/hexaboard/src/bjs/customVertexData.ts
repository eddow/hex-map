import {
	type AbstractEngine,
	Buffer,
	type FloatArray,
	type Geometry,
	type Mesh,
	VertexData,
} from '@babylonjs/core'
import { Game, GameView } from '~/game'

export interface CustomAttributes {
	[key: string]: FloatArray
}

export class CustomVertexData<Attributes extends CustomAttributes> extends VertexData {
	public readonly attributes: Partial<Attributes> = {}
	private readonly engine: AbstractEngine
	public constructor(
		from: Game | GameView | AbstractEngine,
		public readonly customData: Record<keyof Attributes, number>
	) {
		super()
		if (from instanceof Game) from = from.gameView
		if (from instanceof GameView) from = from.engine
		this.engine = from
	}
	private applyTo(target: Mesh | Geometry, updatable?: boolean) {
		// TODO: Check existence & length ?
		for (const [key, size] of Object.entries(this.customData)) {
			const attribute = this.attributes[key]
			if (attribute) {
				const buffer = new Buffer(this.engine, attribute, true)
				target.setVerticesBuffer(buffer.createVertexBuffer(key, 0, size))
			}
		}
	}
	applyToMesh(mesh: Mesh, updatable?: boolean): VertexData {
		this.applyTo(mesh, updatable)
		return super.applyToMesh(mesh, updatable)
	}
	applyToGeometry(geometry: Geometry, updatable?: boolean): VertexData {
		this.applyTo(geometry, updatable)
		return super.applyToGeometry(geometry, updatable)
	}
}
