// inspiration: https://www.shadertoy.com/view/4dS3Wd
float hash(float p, float seed) { p = fract(p * 0.011 + seed); p *= p + (7.5+seed); p *= (p + p - seed); return fract(p); }
float hash(vec2 p, float seed) { vec3 p3 = fract(vec3(p.xyx) * 0.13 + seed); p3 += dot(p3, p3.yzx + 3.333+seed); return fract((p3.x + p3.y) * p3.z); }
// TODO: Hash function degenerate (p ~ 2^5.5)
/*float hash(float p, float seed) {
	p += sin(p * 0.011 + seed) * 43758.5453; // Use sin to maintain variability
	p = fract(p);
    p *= p + (7.5 + seed);
    p *= (p + p - seed);
    return fract(p);
}

float hash(vec2 p, float seed) {
	vec3 p3 = sin(vec3(p.xyx) * 0.13 + seed) * 43758.5453; // Use sin to maintain variability
	p3 = fract(p3);
    p3 += dot(p3, p3.yzx + 3.333 + seed);
    return fract((p3.x + p3.y) * p3.z);
}*/

float noise(float x, float seed) {
	float i = floor(x);
	float f = fract(x);
	float u = f * f * (3.0 - 2.0 * f);
	return mix(hash(i, seed), hash(i + 1.0, seed), u);
}
// That noise degenerates with visible "corners"
float noise(vec2 x, float seed) {
	vec2 i = floor(x);
	vec2 f = fract(x);

	// Four corners in 2D of a tile
	float a = hash(i, seed);
	float b = hash(i + vec2(1.0, 0.0), seed);
	float c = hash(i + vec2(0.0, 1.0), seed);
	float d = hash(i + vec2(1.0, 1.0), seed);

	// Simple 2D lerp using smoothstep envelope between the values.
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}//*/
float noise(vec3 x, float seed) {
	const vec3 step = vec3(110, 241, 171);

	vec3 i = floor(x);
	vec3 f = fract(x);

	// For performance, compute the base input to a 1D hash from the integer part of the argument and the 
	// incremental change to the 1D based on the 3D -> 1D wrapping
	float n = dot(i, step);

	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(mix(hash(n + dot(step, vec3(0, 0, 0)), seed), hash(n + dot(step, vec3(1, 0, 0)), seed), u.x),
		mix(hash(n + dot(step, vec3(0, 1, 0)), seed), hash(n + dot(step, vec3(1, 1, 0)), seed), u.x), u.y),
		mix(mix(hash(n + dot(step, vec3(0, 0, 1)), seed), hash(n + dot(step, vec3(1, 0, 1)), seed), u.x),
		mix(hash(n + dot(step, vec3(0, 1, 1)), seed), hash(n + dot(step, vec3(1, 1, 1)), seed), u.x), u.y), u.z
	);
}
/*float noise(vec2 x, float seed) {
	return noise(vec3(x, 0.), seed);
}*/

float symphony(float n, float seed, int octaves, float persistence, float lacunarity) {
	float total = 0.0, amplitude = 0.5;
	for (int i = 0; i < octaves; i++) {
		total += (noise(n, seed) - 0.5) * amplitude;
		n = n * lacunarity;
		amplitude *= persistence;
	}
	return total;
}
const mat2 m2 = mat2(1.6, 1.2, -1.2, 1.6);
float symphony(vec2 n, float seed, int octaves, float persistence, float lacunarity) {
	float total = 0.0, amplitude = 0.5;
	for (int i = 0; i < octaves; i++) {
		total += (noise(n, seed) - 0.5) * amplitude;
		n = m2 * n * lacunarity;
		amplitude *= persistence;
	}
	return total;
}
const mat3 m = mat3(1.6, 1.2, 0.8, -1.2, 1.6, -0.8, 0.8, -0.4, 1.6);
float symphony(vec3 n, float seed, int octaves, float persistence, float lacunarity) {
	float total = 0.0, amplitude = 0.5;
	for (int i = 0; i < octaves; i++) {
		total += (noise(n, seed) - 0.5) * amplitude;
		n = m * n * lacunarity;
		amplitude *= persistence;
	}
	return total;
}

/**
 * Fractal Brownian Motion
 * @param p: the point to sample
 * @param seed: the seed to use
 * @param octaves: the number of octaves to sample
 * @param pls: (persistence: the persistence of the noise (0.5), lacunarity: the lacunarity of the noise (2.0), scale: the smallest, the most "zoomed in" (1.0))
 * @param range: the range of the noise
 */
float fbm(float seed, vec3 p, int octaves, vec3 pls, vec2 range) {
	return mix(range.x, range.y, .5 + symphony(p * pow(2., pls.z), seed, octaves, pls.x, pls.y));
}
float fbm(float seed, vec2 p, int octaves, vec3 pls, vec2 range) {
	return mix(range.x, range.y, .5 + symphony(p * pow(2., pls.z), seed, octaves, pls.x, pls.y));
}
float fbm(float seed, float p, int octaves, vec3 pls, vec2 range) {
	return mix(range.x, range.y, .5 + symphony(p * pow(2., pls.z), seed, octaves, pls.x, pls.y));
}

vec2 fbm2(float seed, vec3 p, int octaves, vec3 pls, vec2 range) {
	return vec2(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range)
	);
}
vec2 fbm2(float seed, vec2 p, int octaves, vec3 pls, vec2 range) {
	return vec2(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range)
	);
}
vec2 fbm2(float seed, float p, int octaves, vec3 pls, vec2 range) {
	return vec2(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range)
	);
}

vec3 fbm3(float seed, vec3 p, int octaves, vec3 pls, vec2 range) {
	return vec3(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range),
		fbm(seed + 2.0, p, octaves, pls, range)
	);
}
vec3 fbm3(float seed, vec2 p, int octaves, vec3 pls, vec2 range) {
	return vec3(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range),
		fbm(seed + 2.0, p, octaves, pls, range)
	);
}
vec3 fbm3(float seed, float p, int octaves, vec3 pls, vec2 range) {
	return vec3(
		fbm(seed, p, octaves, pls, range),
		fbm(seed + 1.0, p, octaves, pls, range),
		fbm(seed + 2.0, p, octaves, pls, range)
	);
}