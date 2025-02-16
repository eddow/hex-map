// inspiration: https://www.shadertoy.com/view/4dS3Wd
float hash(float p, float seed) { p = fract(p * 0.011 + seed); p *= p + (7.5+seed); p *= (p + p - seed); return fract(p); }
float hash(vec2 p, float seed) { vec3 p3 = fract(vec3(p.xyx) * 0.13); p3 += dot(p3, p3.yzx + 3.333+seed); return fract((p3.x + p3.y) * p3.z); }

float noise(float x, float seed) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i, seed), hash(i + 1.0, seed), u);
}


float noise(vec2 x, float seed) {
    vec2 i = floor(x);
    vec2 f = fract(x);

	// Four corners in 2D of a tile
	float a = hash(i, seed);
    float b = hash(i + vec2(1.0, 0.0), seed);
    float c = hash(i + vec2(0.0, 1.0), seed);
    float d = hash(i + vec2(1.0, 1.0), seed);

    // Simple 2D lerp using smoothstep envelope between the values.
	// return vec3(mix(mix(a, b, smoothstep(0.0, 1.0, f.x)),
	//			mix(c, d, smoothstep(0.0, 1.0, f.x)),
	//			smoothstep(0.0, 1.0, f.y)));

	// Same code, with the clamps in smoothstep and common subexpressions
	// optimized away.
    vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}


float noise(vec3 x, float seed) {
    const vec3 step = vec3(110, 241, 171);

    vec3 i = floor(x);
    vec3 f = fract(x);

    // For performance, compute the base input to a 1D hash from the integer part of the argument and the 
    // incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0)), seed), hash(n + dot(step, vec3(1, 0, 0)), seed), u.x),
		mix( hash(n + dot(step, vec3(0, 1, 0)), seed), hash(n + dot(step, vec3(1, 1, 0)), seed), u.x), u.y),
		mix(mix( hash(n + dot(step, vec3(0, 0, 1)), seed), hash(n + dot(step, vec3(1, 0, 1)), seed), u.x),
		mix( hash(n + dot(step, vec3(0, 1, 1)), seed), hash(n + dot(step, vec3(1, 1, 1)), seed), u.x), u.y), u.z
	);
}


float fbm(float x, float seed, int octaves) {
	float v = 0.5;
	float a = 0.5;
	float shift = float(100);
	for (int i = 0; i < octaves; ++i) {
		v += a * (noise(x, seed)-.5);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}


float fbm(vec2 x, float seed, int octaves) {
	float v = 0.5;
	float a = 0.5;
	vec2 shift = vec2(100);
	// Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	for (int i = 0; i < octaves; ++i) {
		v += a * (noise(x, seed)-.5);
		x = rot * x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}


float fbm(vec3 x, float seed, int octaves) {
	float v = 0.5;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < octaves; ++i) {
		v += a * (noise(x, seed)-.5);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

vec2 fbm2(vec3 x, float seed, int octaves) {
	return vec2(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves)
	);
}
vec2 fbm2(vec2 x, float seed, int octaves) {
	return vec2(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves)
	);
}
vec2 fbm2(float x, float seed, int octaves) {
	return vec2(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves)
	);
}

vec3 fbm3(vec3 x, float seed, int octaves) {
	return vec3(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves),
		fbm(x, seed + 2., octaves)
	);
}
vec3 fbm3(vec2 x, float seed, int octaves) {
	return vec3(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves),
		fbm(x, seed + 2., octaves)
	);
}
vec3 fbm3(float x, float seed, int octaves) {
	return vec3(
		fbm(x, seed, octaves),
		fbm(x, seed + 1., octaves),
		fbm(x, seed + 2., octaves)
	);
}