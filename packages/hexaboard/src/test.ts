import { axial, hexTiles } from './utils'

function* connections(radius: number) {
	for (let ring = 1; ring < radius; ring++) {
		for (let side = 0; side < 6; side++) {
			for (let offset = 0; offset < ring; offset++) {
				const index1 = hexTiles(ring) + side * ring + offset
				const index2 = hexTiles(ring) + ((side * ring + offset + 6 * ring - 1) % (6 * ring))
				const index3 =
					ring === 1 ? 0 : hexTiles(ring - 1) + ((side * (ring - 1) + offset) % (6 * (ring - 1)))
				yield [index1, index2]
				yield [index1, index3]
				if (offset > 0) {
					const index4 = hexTiles(ring - 1) + ((side * (ring - 1) + offset - 1) % (6 * (ring - 1)))
					yield [index1, index4]
				}
			}
		}
	}
}

const C = [...connections(3)]
for (const [a, b] of C) console.log(a, axial.coords(a), b, axial.coords(b))
console.log(C.length)
