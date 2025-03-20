/*
MIT License

Copyright (c) 2014 David Hoskins
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

// Hash without Sine https://www.shadertoy.com/view/4djSRW

//----------------------------------------------------------------------------------------
//  1 out, 1 in...
fn hash11(p1: f32) -> f32
{
	var p = fract(p1 * .1031);
	p *= p + 33.33;
	p *= p + p;
	return fract(p);
}

//----------------------------------------------------------------------------------------
//  1 out, 2 in...
fn hash12(p: vec2f) -> f32
{
	var p3 = fract(vec3f(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
//  1 out, 3 in...
fn hash13(p: vec3f) -> f32
{
	var p3  = fract(p * .1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
//  2 out, 1 in...
fn hash21(p: f32) -> vec2f
{
	var p3 = fract(vec3f(p) * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

//----------------------------------------------------------------------------------------
//  2 out, 2 in...
fn hash22(p: vec2f) -> vec2f
{
	var p3 = fract(vec3f(p.xyx) * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

//----------------------------------------------------------------------------------------
//  2 out, 3 in...
fn hash23(p: vec3f) -> vec2f
{
	var p3 = fract(p * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

//----------------------------------------------------------------------------------------
//  3 out, 1 in...
fn hash31(p: f32) -> vec3f
{
	var p3 = fract(vec3f(p) * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xxy+p3.yzz)*p3.zyx); 
}

//----------------------------------------------------------------------------------------
//  3 out, 2 in...
fn hash32(p: vec2f) -> vec3f
{
	var p3 = fract(vec3f(p.xyx) * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+33.33);
	return fract((p3.xxy+p3.yzz)*p3.zyx);
}

//----------------------------------------------------------------------------------------
//  3 out, 3 in...
fn hash33(p: vec3f) -> vec3f
{
	var p3 = fract(p * vec3f(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+33.33);
	return fract((p3.xxy + p3.yxx)*p3.zyx);
}

//----------------------------------------------------------------------------------------
// 4 out, 1 in...
fn hash41(p: f32) -> vec4f
{
	var p4 = fract(vec4f(p) * vec4f(.1031, .1030, .0973, .1099));
	p4 += dot(p4, p4.wzxy+33.33);
	return fract((p4.xxyz+p4.yzzw)*p4.zywx);
}

//----------------------------------------------------------------------------------------
// 4 out, 2 in...
fn hash42(p: vec2f) -> vec4f
{
	var p4 = fract(vec4f(p.xyxy) * vec4f(.1031, .1030, .0973, .1099));
	p4 += dot(p4, p4.wzxy+33.33);
	return fract((p4.xxyz+p4.yzzw)*p4.zywx);
}

//----------------------------------------------------------------------------------------
// 4 out, 3 in...
fn hash43(p: vec3f) -> vec4f
{
	var p4 = fract(vec4f(p.xyzx)  * vec4f(.1031, .1030, .0973, .1099));
	p4 += dot(p4, p4.wzxy+33.33);
	return fract((p4.xxyz+p4.yzzw)*p4.zywx);
}

//----------------------------------------------------------------------------------------
// 4 out, 4 in...
fn hash44(p: vec4f) -> vec4f
{
	var p4 = fract(p  * vec4f(.1031, .1030, .0973, .1099));
	p4 += dot(p4, p4.wzxy+33.33);
	return fract((p4.xxyz+p4.yzzw)*p4.zywx);
}