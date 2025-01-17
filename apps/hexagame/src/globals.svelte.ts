import type { DockviewApi } from 'dockview-core'
import { Game, Island, LCG, MonoSectorLand } from 'hexaboard'
import { Vector3 } from 'three'

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

const worldSeed = Math.random()
const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6))
land.generate(LCG(worldSeed))
land.virgin()
land.mesh()
export const games: Record<PropertyKey, Game> = {}
games.GameX = new Game(land)

export const dockview = $state({ api: {} as DockviewApi } as { api: DockviewApi })
