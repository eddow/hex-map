#include "fbm.glsl"
#iUniform float seed = 52.
#iUniform float heightScale = -5. in { 0., 20. } // This will expose a slider to edit the value
#iUniform int octaves = 3 in { 1, 15 } // This will expose a slider to edit the value

float height(vec2 p, float seed) {
	return fbm(p * pow(2., heightScale), seed, octaves);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 p = fragCoord/iResolution.xx - vec2(.5, .5);
	fragColor = vec4(height(p, seed), 0., 0., 1.);
}