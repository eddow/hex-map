import { LCG } from './numbers'

export class PerlinNoise {
	private permutation: number[] = []
	private p: number[] = []

	constructor(seed: number) {
		this.permutation = this.generatePermutation(seed)
		this.p = [...this.permutation, ...this.permutation]
	}

	private generatePermutation(seed: number): number[] {
		const gen = LCG(seed)
		const perm = Array.from({ length: 256 }, (_, i) => i)
		for (let i = perm.length - 1; i > 0; i--) {
			const j = Math.floor((gen(seed) * (i + 1)) & 255)
			;[perm[i], perm[j]] = [perm[j], perm[i]]
		}
		return perm
	}

	private fade(t: number): number {
		return t * t * t * (t * (t * 6 - 15) + 10)
	}

	private lerp(t: number, a: number, b: number): number {
		return a + t * (b - a)
	}

	private grad(hash: number, x: number, y: number, z: number): number {
		const h = hash & 15
		const u = h < 8 ? x : y
		const v = h < 4 ? y : h === 12 || h === 14 ? x : z
		return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
	}

	public noise(x: number, y = 0, z = 0): number {
		const X = Math.floor(x) & 255
		const Y = Math.floor(y) & 255
		const Z = Math.floor(z) & 255

		x -= Math.floor(x)
		y -= Math.floor(y)
		z -= Math.floor(z)

		const u = this.fade(x)
		const v = this.fade(y)
		const w = this.fade(z)

		const A = this.p[X] + Y
		const AA = this.p[A] + Z
		const AB = this.p[A + 1] + Z
		const B = this.p[X + 1] + Y
		const BA = this.p[B] + Z
		const BB = this.p[B + 1] + Z

		return this.lerp(
			w,
			this.lerp(
				v,
				this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
				this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))
			),
			this.lerp(
				v,
				this.lerp(
					u,
					this.grad(this.p[AA + 1], x, y, z - 1),
					this.grad(this.p[BA + 1], x - 1, y, z - 1)
				),
				this.lerp(
					u,
					this.grad(this.p[AB + 1], x, y - 1, z - 1),
					this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
				)
			)
		)
	}
}
export class HeightMap {
	private perlin: PerlinNoise
	private scale: number // Scale of the Perlin noise
	private heightRange: [number, number] // Min and max height in meters

	constructor(seed: number, scale = 1, heightRange: [number, number] = [0, 100]) {
		this.perlin = new PerlinNoise(seed)
		this.scale = scale
		this.heightRange = heightRange
	}

	public getHeight(x: number, y: number): number {
		// Scale the input coordinates
		const nx = x / this.scale
		const ny = y / this.scale

		// Generate Perlin noise value (normalized to 0 to 1)
		const noiseValue = (this.perlin.noise(nx, ny) + 1) / 2

		// Map noise value to height range
		const [minHeight, maxHeight] = this.heightRange
		return minHeight + noiseValue * (maxHeight - minHeight)
	}
}
