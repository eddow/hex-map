import { PerlinTerrain } from 'hexaboard'
import type { GameXTile } from '../game'

export const terrainHeight = 160
export const seaLevel = 70
const mountainsFrom = 130
// TODO Kil this file (back to `terrain.ts`)
export function terrainFactory(seed: number) {
	return new PerlinTerrain<GameXTile, 'height' | 'type' | 'rocky'>(
		seed,
		{
			height: {
				variation: [0, 160],
				scale: 1000,
			},
			type: {
				variation: [-1, 1],
				scale: 500,
			},
			rocky: {
				variation: [-1, 1],
				scale: 100,
			},
		},
		(from, generation) => {
			const isMountain = generation.height > mountainsFrom
			if (isMountain) {
				return {
					...from,
					position: {
						...from.position,
						y: generation.height + generation.rocky * (generation.height - mountainsFrom),
					},
					terrain: generation.height > 155 ? 'snow' : 'stone',
				} as GameXTile
			}
			const y = generation.height
			return y > 75
				? ({
						...from,
						position: {
							...from.position,
							y,
						},
						terrain: generation.type > 0 ? 'forest' : 'grass',
					} as GameXTile)
				: ({
						...from,
						position: {
							...from.position,
							y,
						},
						terrain: 'sand',
					} as GameXTile)
		}
	)
}
