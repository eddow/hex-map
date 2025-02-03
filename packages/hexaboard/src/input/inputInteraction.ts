import type { GameView } from '~/game'
import { assert } from '~/utils'
import type { InputActions, InterfaceConfigurations, SelectiveAction } from './actions'
import { D2Buffer } from './d2buffer'

export class InputMode<Actions extends InputActions> {
	actions: SelectiveAction<Actions>[]
	constructor(...actions: SelectiveAction<Actions>[]) {
		this.actions = actions
	}
}
export class InputInteraction<Actions extends InputActions = InputActions> extends D2Buffer {
	public views = new Map<HTMLCanvasElement, GameView>()
	constructor(
		private readonly globalMode: InputMode<Actions>,
		private configurations: InterfaceConfigurations<Actions>
	) {
		super()
	}
	dispose() {
		for (const view of this.views.values()) this.detach(view)
	}
	attach(gameView: GameView) {
		assert(
			this.views.values().every((v) => v.game === gameView.game),
			'Only one game per InputInteraction'
		)
		if (this.views.size === 0) gameView.game.on('progress', this.dispatchEvents)
		this.views.set(gameView.canvas, gameView)
		this.listenTo(gameView.canvas)
		gameView.game.on('progress', (dt) => this.dispatchEvents(dt))
	}
	detach(gameView: GameView) {
		this.views.delete(gameView.canvas)
		if (this.views.size === 0) gameView.game.off('progress', this.dispatchEvents)
		this.unListenTo(gameView.canvas)
	}
	// TODO
	// Must be lambda so that it is bound
	dispatchEvents = (dt: number) => {
		if (this.size) {
			for (const event of this.d2events()) {
				console.log(event.type)
			}
		}
	}
}

// #region Test

// #endregion
