#define ANIMATE
#define BORDER_VALUE 0.2  // You can adjust this value between 0 and 0.5
#define HEIGHT_SCALE 40.0
#define DISPLACEMENT_SCALE 1.0

vec2 hash(vec2 p, float seed) {
	p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
	return -1.0 + 2.0*fract(sin(p + seed)*43758.5453123);
}

float noise(in vec2 p, float seed) {
	const float K1 = 0.366025404; // (sqrt(3)-1)/2;
	const float K2 = 0.211324865; // (3-sqrt(3))/6;
	vec2 i = floor(p + (p.x+p.y)*K1);	
	vec2 a = p - i + (i.x+i.y)*K2;
	vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0); //vec2 of = 0.5 + 0.5*vec2(sign(a.x-a.y), sign(a.y-a.x));
	vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;
	vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0, seed)), dot(b,hash(i+o, seed)), dot(c,hash(i+1.0, seed)));
	return dot(n, vec3(70.0));	
}

const mat2 m = mat2(1.6,  1.2, -1.2,  1.6);
float symphony(vec2 n, float seed, int octaves) {
	float total = 0.0, amplitude = 0.1;
	for (int i = 0; i < octaves; i++) {
		total += noise(n, seed) * amplitude;
		n = m * n;
		amplitude *= 0.4;
	}
	return total;
}

float height(vec2 p, float seed) {
	return .5 + 4.0 * symphony(p / HEIGHT_SCALE, seed, 7);
}

vec2 displacement(vec2 p, float seed) {
	return vec2(
		4. * symphony(p / DISPLACEMENT_SCALE, seed+1., 2),
		4. * symphony(p / DISPLACEMENT_SCALE, seed+2., 2)
	);
}
	
vec2 white(vec2 p) {
	// procedural white noise	
	vec2 noise = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
	vec2 o = BORDER_VALUE + noise * (1.0 - 2.0 * BORDER_VALUE); 
	#ifdef ANIMATE
	o = BORDER_VALUE + (1.0 - 2.0 * BORDER_VALUE) * (0.5 + 0.5*sin( iTime + 6.2831*o ));
	#endif	
	return o;
}

float whiteZ(vec2 p) {
	return fract(sin(dot(p, vec2(419.2, 573.1))) * 43758.5453);
}

float distanceToLine(vec2 x, vec2 a, vec2 b) {
	vec2 ab = b - a;
	vec2 ax = x - a;
	float ab2 = dot(ab, ab);
	float abax = dot(ab, ax);
	float t = clamp(abax / ab2, 0.0, 1.0);
	vec2 closestPointOnLine = a + t * ab;
	return distance(x, closestPointOnLine);
}	