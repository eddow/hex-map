import { games } from '$lib/globals.svelte'
import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core'
import type { GameView } from 'hexaboard'

export class GameViewRenderer implements IContentRenderer {
	private gv?: GameView
	private nog = document.createElement('div')
	constructor(public readonly id: string) {}
	get element(): HTMLElement {
		this.nog.textContent = 'No game selected'
		return this.gv?.canvas || this.nog
	}
	init(parameters: GroupPanelPartInitParameters): void {
		const { game } = parameters.params
		this.gv = games[game]?.createView()
		const { camera } = this.gv
		camera.position.set(0, 0, 100)
		camera.lookAt(0, 0, 0)
		this.gv.canvas.style.width = '100%'
		this.gv.canvas.style.height = '100%'
		this.gv.game.running = true
	}
	layout?(width: number, height: number): void {
		this.gv?.resize(width, height)
	}
	dispose(): void {
		alert('vpispose!')
	}

	/*
	focus?(): void {
		//throw new Error('Method not implemented.');
	}
	dispose?(): void {
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
