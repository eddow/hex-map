//#version 300 es
uniform sampler2D textures[3];
varying vec2 vUv[3];
varying vec3 bary;

float quadraticInfluence(float coord) {
    return 4.0 * coord * coord; // Quadratic function scaled to reach 1 at coord = 0.5
}

void main() {
	vec4 color1 = texture2D(textures[0], vUv[0]);
	vec4 color2 = texture2D(textures[1], vUv[1]);
	vec4 color3 = texture2D(textures[2], vUv[2]);
	
	// Compute weights
	float weight1 = quadraticInfluence(bary.x);
	float weight2 = quadraticInfluence(bary.y);
	float weight3 = quadraticInfluence(bary.z);

	// Normalize weights to ensure they sum to 1
	float sum = weight1 + weight2 + weight3;
	weight1 /= sum;
	weight2 /= sum;
	weight3 /= sum;

	// Apply the weights to the colors
	gl_FragColor = color1 * weight1 + color2 * weight2 + color3 * weight3;
}