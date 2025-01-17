import type { Game } from 'hexaboard'

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

export const games: Record<PropertyKey, Game> = {}
