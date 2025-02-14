import type { AxialDirection, Sextuplet } from 'hexaboard'

export const pawnHealth = 12

export function duodecimal(n: number) {
	return n.toString(12).replaceAll('a', '\u218a').replaceAll('b', '\u218b')
}

export const pawnTypes = {
	swordMan: {
		color: { r: 1, g: 0, b: 0 },
	},
	archer: {
		color: { r: 0, g: 0, b: 1 },
	},
} as const

export type PawnType = keyof typeof pawnTypes

export const formations: Sextuplet<AxialDirection[]> = [
	[null],
	[0, 3],
	[0, 2, 4],
	[0, 1, 3, 5],
	[null, 1, 2, 4, 5],
	[0, 1, 2, 3, 4, 5],
]
