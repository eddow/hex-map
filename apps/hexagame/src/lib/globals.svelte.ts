//import { createGame } from '$lib/hexClash/game'
import { createGame } from '$lib/gameX/game'
import type { DockviewApi } from 'dockview-core'
import { type Game, debugInformation } from 'hexaboard'

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

export const games: Record<PropertyKey, Game> = {
	GameX: createGame('GameX', 59676782),
}

export const dockview = $state({ api: {} as DockviewApi } as { api: DockviewApi })

export const debugInfo = $state({} as Record<string, any>)

debugInformation.set = (key: string, value: any) => {
	debugInfo[key] = value
}
