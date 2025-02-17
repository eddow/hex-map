import type { TransformNode } from '@babylonjs/core'
import type { Land, TileBase } from '~/ground/land'
import {
	type InputActions,
	InputInteraction,
	type InputMode,
	type InterfaceConfigurations,
} from '~/input'
import { Eventful, MeshUtils } from '~/utils'
import type { GameView } from './gameView'

export abstract class GameEntity {
	constructor(public readonly node: TransformNode) {}
	progress(dt: number) {}
}

export type GameEvents = {
	progress(dt: number): void
}

export class Game<
	Tile extends TileBase = TileBase,
	Actions extends InputActions = InputActions,
> extends Eventful<GameEvents> {
	public gameSpeed = 1
	public readonly meshUtils: MeshUtils
	public readonly inputInteraction: InputInteraction<Actions>
	constructor(
		public readonly gameView: GameView,
		public readonly land: Land<Tile>,
		configurations: InterfaceConfigurations<Actions>,
		globalMode: InputMode<Actions>,
		usedMode?: InputMode<Actions>
	) {
		super()
		gameView.game = this
		this.meshUtils = new MeshUtils(gameView.scene)
		this.inputInteraction = new InputInteraction(gameView, configurations, globalMode, usedMode)
		// TODO: add background game evolution?
		gameView.scene.onBeforeRenderObservable.add(() => {
			const dt = (this.gameView.scene.deltaTime * this.gameSpeed) / 1000 // seconds
			if (this.gameView.updated) this.land.updateView()
			if (this.gameSpeed > 0) {
				this.land.progress(dt)
				this.emit('progress', dt)
			}
		})
	}
	dispose() {
		this.inputInteraction.dispose()
		this.gameView.dispose()
	}
}
