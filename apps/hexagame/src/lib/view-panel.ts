import { loadGame } from '$lib/globals.svelte'
import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core'
import { type Game, GameView } from 'hexaboard'

export class GameViewRenderer implements IContentRenderer {
	private gameView: GameView
	private canvas: HTMLCanvasElement
	private game?: Game
	constructor(public readonly id: string) {
		this.canvas = document.createElement('canvas')
		this.canvas.style.width = '100%'
		this.canvas.style.height = '100%'
		this.gameView = new GameView(this.canvas)
	}
	get element(): HTMLElement {
		return this.canvas
	}
	init(parameters: GroupPanelPartInitParameters): void {
		const { game } = parameters.params
		this.game = loadGame(game, this.gameView, 592338)
	}
	layout?(width: number, height: number): void {
		this.gameView.resize(width, height)
	}
	dispose(): void {
		this.game?.dispose()
	}

	/*
	focus?(): void {
		//throw new Error('Method not implemented.');
	}
	update(event: PanelUpdateEvent<Parameters>): void {
		//throw new Error('Method not implemented.')
	}
	toJSON(): object {
		//throw new Error('Method not implemented.')
	}
	*/
}
export default function createGameViewRenderer(id: string): GameViewRenderer {
	return new GameViewRenderer(id)
}
