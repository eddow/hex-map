import type { Intersection, Mesh, Object3D, Object3DEventMap } from 'three'
import type { Character } from '~/character'
import type { HeightPowGen } from '~/hexagon/pow2gen'
import type HexSector from '~/hexagon/sector'
import { icosahedron } from './meshes'

// Used when giving an order, when the interaction is not only "select"
export const interactionContext: { pawn?: Character } = {}

export interface InteractionSpecs {
	interaction: MouseInteraction
	handle: MouseHandle
}
export const hoveredSpecs: Partial<InteractionSpecs> = {}

export interface MouseReactive {
	mouseInteraction: MouseInteraction
	mouseHandle?(intersection: Intersection<Object3D<Object3DEventMap>>): MouseHandle
}
export interface MouseHandle {
	target: MouseReactive
}

export interface MouseInteraction {
	leave?(handle: MouseHandle): void
	enter?(handle: MouseHandle): void
	move?(handleTo: MouseHandle, handleFrom?: MouseHandle): void
	click?(handle: MouseHandle, button: number): void
	down?(handle: MouseHandle, button: number): void
	up?(handle: MouseHandle, button: number): void
	animate?(dt: DOMHighResTimeStamp): void
}

export interface TileHandle {
	target: HexSector
	hexIndex: number
}

let highlight: Mesh | undefined
export const tileInteraction: MouseInteraction = {
	leave({ target }: TileHandle) {
		if (highlight) {
			target.group.remove(highlight)
			highlight = undefined
		}
	},
	enter({ target }: TileHandle) {
		if (!highlight) {
			highlight = icosahedron(target.tileSize, {
				color: 0xffffff,
				wireframe: true,
			})
			target.group.add(highlight)
		}
	},
	move({ target, hexIndex }: TileHandle, handleFrom?: TileHandle) {
		if (target !== handleFrom?.target || hexIndex !== handleFrom?.hexIndex) {
			highlight!.position.copy(target.vPosition(hexIndex))
		}
	},
	click({ target, hexIndex }: TileHandle, button) {
		interactionContext.pawn!.goTo(target, hexIndex) /*
		const s = target as HeightPowGen
		for (let i = 0; i < s.points.length; i++) {
			s.points[i].type = 'no'
		}
		s.points[hexIndex].type = 'snow'
		s.meshTerrain()*/
	},
	// down(handle, button) {},
	// up(handle, button) {},
	animate(dt: DOMHighResTimeStamp) {
		highlight!.rotation.x += dt
		highlight!.rotation.y += dt
	},
}
