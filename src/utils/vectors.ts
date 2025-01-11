export interface V2 {
	x: number
	y: number
}
export interface V3 extends V2 {
	z: number
}
function sum(...args: number[]) {
	return args.reduce((a, b) => a + b, 0)
}
const vals = Object.values

const availCoords = ['x', 'y', 'z']

function coords<V extends V2>(fct: (...args: number[]) => number, ...args: V[]) {
	const rv = {} as V
	// @ts-expect-error
	for (const c of availCoords) if (args.every((a) => c in a)) rv[c] = fct(...args.map((a) => a[c]))
	return rv
}

export function vDiff<V extends V2>(a: V, b: V) {
	return coords((a, b) => a - b, a, b)
}

export function vDistance<V extends V2>(a: V, b: V) {
	return Math.sqrt(sum(...vals(vDiff(a, b)).map((v) => v * v)))
}

export function vProd<V extends V2>(a: V, f: number) {
	return coords((a) => a * f, a)
}

export function vSum<V extends V2>(...args: V[]) {
	return coords(sum, ...args)
}
