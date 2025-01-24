import { games } from '$lib/globals.svelte'
import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core'
import type { GameView } from 'hexaboard'

export class GameViewRenderer implements IContentRenderer {
	private gv?: GameView
	private canvas: HTMLCanvasElement
	constructor(public readonly id: string) {
		this.canvas = document.createElement('canvas')
		this.canvas.style.width = '100%'
		this.canvas.style.height = '100%'
	}
	get element(): HTMLElement {
		return this.canvas
	}
	init(parameters: GroupPanelPartInitParameters): void {
		const { game } = parameters.params
		this.gv = games[game]?.createView(this.canvas, { near: 0.1, far: 3000 })
		const { camera } = this.gv
		camera.position.set(0, 0, 200)
		camera.lookAt(0, 0, 0)
		this.gv.game.running = true
	}
	layout?(width: number, height: number): void {
		this.gv?.resize(width, height)
	}
	dispose(): void {
		this.gv?.game.removeView(this.gv)
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
