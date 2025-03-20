/*
MIT License

Copyright (c) 2013 Inigo Quilez <https://iquilezles.org/>
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

// Simplex Noise (http://en.wikipedia.org/wiki/Simplex_noise), a type of gradient noise
// that uses N+1 vertices for random gradient interpolation instead of 2^N as in regular
// latice based Gradient Noise.

// Simplex Noise 2D: https://www.shadertoy.com/view/Msf3WH

@import hash, noiseCommon

fn noiseSimplex2d(p: vec2f) -> f32
{
	let K1 = 0.366025404; // (sqrt(3)-1)/2;
	let K2 = 0.211324865; // (3-sqrt(3))/6;
	let i = floor( p + (p.x+p.y)*K1 );
	let a = p - i + (i.x+i.y)*K2;
	let o = step(a.yx,a.xy);
	let b = a - o + K2;
	let c = a - 1.0 + 2.0*K2;
	let h = max( 0.5-vec3f(dot(a,a), dot(b,b), dot(c,c) ), vec3f(0.) );
	let n = h*h*h*h*vec3f(
		dot(a, hash22(i + 1.) * 2. - 1.),
		dot(b, hash22(i + 1. + o) * 2. - 1.),
		dot(c, hash22(i + 2.) * 2. - 1.)
    );
	return dot( n, vec3f(70.0) );
}

fn simplex2d_fractal(p: vec2f, seed: f32) -> f32 {
	var uv = p;
    //let m = mat2x2f( 1.6,  1.2, -1.2,  1.6 );
	let h = hash41(seed);
	let m = mat2x2f( 1.5 + 0.5 * h.x, 1.0 + 0.5 * h.y, -1.0 - 0.5 * h.z, 1.5 + 0.5 * h.w );
	var f = 0.5000*noiseSimplex2d( uv );
	uv = m*uv; f += 0.2500*noiseSimplex2d( uv );
	uv = m*uv; f += 0.1250*noiseSimplex2d( uv );
	uv = m*uv; f += 0.0625*noiseSimplex2d( uv );
	return atan_remap_inverse(0.5 + 0.5*f, 2.5);
}