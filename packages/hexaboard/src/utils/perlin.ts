import { LCG } from './numbers'

export class PerlinNoise {
	private permutation: number[] = []

	constructor(seed: number) {
		const permutation = this.generatePermutation(seed)
		this.permutation = [...permutation, ...permutation]
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

	private grad3: Float32Array = new Float32Array([
		1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
		1, 0, 1, -1, 0, -1, -1,
	])
	private dot(g: number, x: number, y: number, z: number): number {
		const gi = (g % 12) * 3
		return this.grad3[gi] * x + this.grad3[gi + 1] * y + this.grad3[gi + 2] * z
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

		const A = this.permutation[X] + Y
		const AA = this.permutation[A] + Z
		const AB = this.permutation[A + 1] + Z
		const B = this.permutation[X + 1] + Y
		const BA = this.permutation[B] + Z
		const BB = this.permutation[B + 1] + Z

		return this.lerp(
			w,
			this.lerp(
				v,
				this.lerp(
					u,
					this.dot(this.permutation[AA], x, y, z),
					this.dot(this.permutation[BA], x - 1, y, z)
				),
				this.lerp(
					u,
					this.dot(this.permutation[AB], x, y - 1, z),
					this.dot(this.permutation[BB], x - 1, y - 1, z)
				)
			),
			this.lerp(
				v,
				this.lerp(
					u,
					this.dot(this.permutation[AA + 1], x, y, z - 1),
					this.dot(this.permutation[BA + 1], x - 1, y, z - 1)
				),
				this.lerp(
					u,
					this.dot(this.permutation[AB + 1], x, y - 1, z - 1),
					this.dot(this.permutation[BB + 1], x - 1, y - 1, z - 1)
				)
			)
		)
	}
	public symphony(
		x: number,
		y = 0,
		z = 0,
		octaves = 6,
		persistence = 0.5,
		lacunarity = 2.0
	): number {
		let result = 0.0
		let frequency = 1.0
		let amplitude = 1.0

		for (let i = 0; i < octaves; i++) {
			result += this.noise(x * frequency, y * frequency, z * frequency) * amplitude
			frequency *= lacunarity
			amplitude *= persistence
		}

		return result
	}
}
export class HeightMap {
	private readonly perlin: PerlinNoise
	private readonly scale: number // Scale of the Perlin noise
	private readonly heightRange: [number, number] // Min and max height in meters

	constructor(
		seed: number,
		scale = 1,
		heightRange: [number, number] = [0, 100],
		private defaultOctaves = 6
	) {
		this.perlin = new PerlinNoise(seed)
		this.scale = scale
		this.heightRange = heightRange
	}

	public getHeight(x: number, y: number, octaves?: number): number {
		// Scale the input coordinates
		const nx = x / this.scale
		const ny = y / this.scale

		// Generate Perlin noise value (normalized to 0 to 1)
		const noiseValue = (this.perlin.symphony(nx, ny, 0, octaves || this.defaultOctaves) + 1) / 2

		// Map noise value to height range
		const [minHeight, maxHeight] = this.heightRange
		return minHeight + noiseValue * (maxHeight - minHeight)
	}
}
