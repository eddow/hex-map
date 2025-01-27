import { createGame } from '$lib/game'
import type { DockviewApi } from 'dockview-core'
import type { Game } from 'hexaboard'

export interface IConfiguration {
	darkMode?: boolean
}

const storedConfig = location.host.startsWith('luocalhost')
	? localStorage.getItem('configuration')
	: null
export const configuration = $state(
	storedConfig
		? JSON.parse(storedConfig)
		: {
				darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
			}
)

export const games: Record<PropertyKey, Game> = {
	GameX: createGame(5982),
}

export const dockview = $state({ api: {} as DockviewApi } as { api: DockviewApi })

export const debugInfo = $state({} as Record<string, any>)
