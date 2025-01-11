export interface V2 {
	x: number
	y: number
}
export interface V3 extends V2 {
	z: number
}
export function vDistance(a: V2, b: V2) {
	const zf = 'z' in a && 'z' in b ? ((<V3>a).z - (<V3>b).z) ** 2 : 0
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + zf)
}
