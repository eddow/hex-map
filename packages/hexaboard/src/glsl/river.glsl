#include "common.glsl"
#include "fbm.glsl"
#include "hex.glsl"

#iUniform float nodeProbability = 0.4 in { 0.0, 1.0 } // This will expose a slider to edit the value
#iUniform float seaLevel = 0.5 in { 0.0, 1.0 } // This will expose a slider to edit the value
#iUniform float seed = 52.
#iUniform int searchRings = 3 in { 1, 6 }
#iUniform float heightScale = 0. in { -10., 20. } // This will expose a slider to edit the value
#iUniform int octaves = 3 in { 1, 15 } // This will expose a slider to edit the value
const float far = 1e10;

float height(vec2 p, float seed) {
	return fbm(p * pow(2., heightScale), seed, octaves);
}
#iUniform float displacementScale = 6. in { -12., 12. } // This will expose a slider to edit the value
#iUniform float displacementMultiplier = -6. in { -12., 12. } // This will expose a slider to edit the value

vec2 displacement(vec2 p, float seed) {
	return pow(2., displacementMultiplier) * fbm2(p * pow(2., displacementScale), seed+1.1, 2);
}

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
	return whiteZ(hex) < nodeProbability;
}

vec2 descendant(vec2 hex, vec2 hexPos, float centerH) {
	//float centerH = height(hexPos, seed);
	if(centerH < seaLevel) return vec2(0.0);
	float foundH = centerH;
	vec2 descendant = vec2(0.0);
	int i = 0;
	for(int ring = 0; ring < searchRings; ring++) {
		vec2 seaShortcut = vec2(0.);
		for (; i < neighborRing[ring]; i++) {
			vec2 neighborHex = hex + hexNeighbors[i];  // Use axial coordinates for neighbors
			vec2 neighbor = noisyH2W(neighborHex);   // Convert only for distance
			float neighborH = height(neighbor, seed);
			if(!exist(neighborHex)) {
				if(neighborH < seaLevel) seaShortcut = neighbor;
				continue;
			}

			if (neighborH < foundH) {
				foundH = neighborH;
				descendant = neighbor;
			}
		}
		if(descendant == vec2(0.) && seaShortcut != vec2(0.))
			descendant = seaShortcut;
		if(descendant != vec2(0.0)) break;

	}
	return descendant;
}

float distDesc(vec2 x, vec2 hex, vec2 hexPos, float height) {
	vec2 descendantPos = descendant(hex, hexPos, height);
	if(descendantPos == vec2(0.0)) return far;
	return distanceToLine(x, descendantPos, hexPos).x;
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
		float neighborH = height(neighbor, seed);
		if(!exist(neighborHex) || neighborH < seaLevel) continue;
		float dist = distance(x, neighbor);
		rd = min(rd, dist);
		float dd = distDesc(x, neighborHex, neighbor, neighborH);
		rd = min(rd, dd);
	}
	vec2 hexPos = noisyH2W(hex);
	float cHeight = height(hexPos, seed);
	if(!exist(hex) || cHeight < seaLevel)
		return rd;

	float dist = distance(x, hexPos);
	rd = min(rd, dist);
	float dd = distDesc(x, hex, hexPos, cHeight);
	rd = min(rd, dd);

	return rd;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	vec2 p = (fragCoord/iResolution.xx - vec2(.5, .5));
	vec2 dsp = (p*2.+displacement(p, seed))*32.;
	float h = height(dsp, seed);
	float d = 1.-nearestPoints(dsp);
	//d = smoothstep(0.9, 1.0, d);
	float o = h<seaLevel?h+1.-seaLevel:0.;
	float r = h>seaLevel?h:0.;
	fragColor = vec4(r, d, o, 1.0);
}