export interface V3 {
	x: number
	y: number
	z: number
}
export function v3distance(a: V3, b: V3) {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}
