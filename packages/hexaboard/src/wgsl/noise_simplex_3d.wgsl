/*
MIT License

Copyright (c) 2013 Nikita Miropolskiy
Copyright (c) 2022 David A Roberts <https://davidar.io/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Simplex Noise 3D: https://www.shadertoy.com/view/XsX3zB

@import hash

fn noise_simplex_3d(p: vec3f) -> f32
{
	/* skew constants for 3d simplex functions */
	let F3 = 0.3333333;
	let G3 = 0.1666667;

	/* 1. find current tetrahedron T and it's four vertices */
	/* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
	/* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/

	/* calculate s and x */
	let s = floor(p + dot(p, vec3f(F3)));
	let x = p - s + dot(s, vec3f(G3));

	/* calculate i1 and i2 */
	let e = step(vec3f(0.0), x - x.yzx);
	let i1 = e*(1.0 - e.zxy);
	let i2 = 1.0 - e.zxy*(1.0 - e);

	/* x1, x2, x3 */
	let x1 = x - i1 + G3;
	let x2 = x - i2 + 2.0*G3;
	let x3 = x - 1.0 + 3.0*G3;

	/* 2. find four surflets and store them in d */
	var w = vec4f(0.);
	var d = vec4f(0.);

	/* calculate surflet weights */
	w.x = dot(x, x);
	w.y = dot(x1, x1);
	w.z = dot(x2, x2);
	w.w = dot(x3, x3);

	/* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
	w = max(0.6 - w, vec4f(0.0));

	/* calculate surflet components */
	d.x = dot(hash33(s + 1.) - .5, x);
	d.y = dot(hash33(s + 1. + i1) - .5, x1);
	d.z = dot(hash33(s + 1. + i2) - .5, x2);
	d.w = dot(hash33(s + 2.) - .5, x3);

	/* multiply d by w^4 */
	w *= w;
	w *= w;
	d *= w;

	/* 3. return the sum of the four surflets */
	return dot(d, vec4f(52.0));
}

fn generate_s3df_rotation(seed: f32) -> mat3x3f {
	let h1 = normalize(hash31(seed) * 2.0 - 1.0);
	let h2 = normalize(hash31(seed + 1.0) * 2.0 - 1.0);
	let h3 = cross(h1, h2); // Ensure orthogonality
	let h2 = cross(h3, h1); // Recalculate h2 to be orthogonal

	return mat3x3f(
		h1.x, h2.x, h3.x, 
		h1.y, h2.y, h3.y, 
		h1.z, h2.z, h3.z
	);
}

// TODO: make rotations var<private> and calculate on init
fn simplex3d_fractal(m: vec3f, seed: f32) {
	/*let rot1 = mat3x3f(-0.37, 0.36, 0.85,-0.14,-0.93, 0.34,0.92, 0.01,0.4);
	let rot2 = mat3x3f(-0.55,-0.39, 0.74, 0.33,-0.91,-0.24,0.77, 0.12,0.63);
	let rot3 = mat3x3f(-0.71, 0.52,-0.47,-0.08,-0.72,-0.68,-0.7,-0.45,0.56);*/
	return   0.5333333*noise_simplex_3d(m*generate_s3df_rotation(seed))
			+0.2666667*noise_simplex_3d(2.0*m*generate_s3df_rotation(seed + 10.0))
			+0.1333333*noise_simplex_3d(4.0*m*generate_s3df_rotation(seed + 20.0))
			+0.0666667*noise_simplex_3d(8.0*m);
}
