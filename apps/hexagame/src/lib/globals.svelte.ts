//import { createGame } from '$lib/hexClash/game'
import GameX from '$lib/gameX/game'
import type { DockviewApi } from 'dockview-core'
import { type Game, type GameView, debugInformation } from 'hexaboard'

export interface IConfiguration {
	darkMode?: boolean
}

const storedConfig = localStorage.getItem('configuration')
export const configuration = $state(
	storedConfig
		? JSON.parse(storedConfig)
		: {
				darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
			}
)

const games: Record<string, { new (gameView: GameView, seed: number): Game }> = {
	GameX,
}

export let game: Game | undefined
export function loadGame(type: string, gameView: GameView, seed: number) {
	game = new games[type](gameView, seed)
	return game
}

export const dockview = $state({ api: {} as DockviewApi } as { api: DockviewApi })

export const debugInfo = $state({} as Record<string, any>)

debugInformation.set = (key: string, value: any) => {
	debugInfo[key] = value
}
