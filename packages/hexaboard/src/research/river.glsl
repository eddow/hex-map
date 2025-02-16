#include "common.glsl"
#include "hex.glsl"
#include "rings.glsl"

#define POINT_AMPLIFICATION 2.0
#define LOOKUP_RADIUS 1
#define NODE_PROBABILITY .4
#define SEA_LEVEL .5
#define SEED 52.
float far = 1e10;

// Simple 3D hash function for deterministic noise
float hash3(vec3 p) {
	return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

// Generate a 3D noise-based offset inside a hex
vec2 hexNoiseOffset(vec2 hex) {
	// 3D noise from hex coordinates =
	float n1 = hash3(vec3(hex, 0.123));
	float n2 = hash3(vec3(hex, 0.456));

	// Centered noise [-0.5, 0.5]
	vec2 offset = vec2(n1, n2) - 0.5;

	// Uniformly scale noise to fit inside hexagon
	offset *= 0.866; // √3/2 ≈ 0.866 (inscribed circle radius)

	return offset;
}

// Noisy point in hex coordinates
vec2 noisyH2W(vec2 hex) {
	vec2 center = hexToWorld(hex);
	return center + hexNoiseOffset(hex);
}

bool exist(in vec2 hex) {
	return whiteZ(hex) < NODE_PROBABILITY;
}

vec2 descendant(vec2 hex, vec2 hexPos) {
	float centerH = height(hexPos, SEED);
	if(centerH < SEA_LEVEL) return vec2(0.0);
	float foundH = centerH;
	vec2 descendant = vec2(0.0);
	int i = 0;
	for(int ring = 0; ring < 3; ring++) {
		int begun = i;
		for (; i < neighborRing[ring]; i++) {
			vec2 neighborHex = hex + hexNeighbors[i];  // Use axial coordinates for neighbors
			vec2 neighbor = noisyH2W(neighborHex);   // Convert only for distance
			float neighborH = height(neighbor, SEED);
			if(!exist(neighborHex)) continue;

			if (neighborH < foundH) {
				foundH = neighborH;
				descendant = neighbor;
			}
		}
		if(descendant != vec2(0.0)) break;

		for (i = begun; i < neighborRing[ring]; i++) {
			vec2 neighborHex = hex + hexNeighbors[i];  // Use axial coordinates for neighbors
			vec2 neighbor = noisyH2W(neighborHex);   // Convert only for distance
			float neighborH = height(neighbor, SEED);
			if(neighborH < SEA_LEVEL) {
				foundH = neighborH;
				descendant = neighbor;
				break;
			}
		}
		if(descendant != vec2(0.0)) break;
	}
	return descendant;
}

float distDesc(vec2 x, vec2 hex, vec2 hexPos) {
	vec2 descendantPos = descendant(hex, hexPos);
	if(descendantPos == vec2(0.0)) return far;
	return distanceToLine(x, descendantPos, hexPos);
}

// Find nearest point using hex grid and check descendants
float nearestPoints(in vec2 x) {
	vec2 hex = worldToHex(x);
	
	//return 1.;
	// take a neighbor's distance
	float rd = far;
	for (int i = 0; i < NBR_NEIGHBORS; i++) {
		vec2 neighborHex = hex + hexNeighbors[i];  // Use axial coordinates for neighbors
		vec2 neighbor = noisyH2W(neighborHex);
		float neighborH = height(neighbor, SEED);
		if(!exist(neighborHex) || neighborH < SEA_LEVEL) continue;
		float dist = distance(x, neighbor);
		rd = min(rd, dist);
		float dd = distDesc(x, neighborHex, neighbor);
		rd = min(rd, dd);
	}
	vec2 hexPos = noisyH2W(hex);
	float cHeight = height(hexPos, SEED);
	if(!exist(hex) || cHeight < SEA_LEVEL)
		return rd;

	float dist = distance(x, hexPos);
	rd = min(rd, dist);
	float dd = distDesc(x, hex, hexPos);
	rd = min(rd, dd);

	return rd;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	vec2 p = (fragCoord/iResolution.xx - vec2(.5, .5));
	vec2 dsp = p*2.+displacement(p, SEED);
	dsp = dsp*40.;
	float h = height(dsp, SEED);
	float d = 1.-nearestPoints(dsp);
	d = smoothstep(0.9, 1.0, d);
	float o = h<SEA_LEVEL?h+1.-SEA_LEVEL:0.;
	float r = h>SEA_LEVEL?h:0.;
	fragColor = vec4(r, d, o, 1.0);
}