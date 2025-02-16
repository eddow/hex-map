#include "common.glsl"
#define SEED 52.

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 p = fragCoord/iResolution.xx - vec2(.5, .5);
	float c = height(p*80.0, SEED);
	fragColor = vec4(c, 0., 0., 1.);
}