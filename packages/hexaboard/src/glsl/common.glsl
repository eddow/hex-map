float whiteZ(vec2 p) {
	return fract(sin(dot(p, vec2(419.2, 573.1))) * 43758.5453);
}

/**
 * Returns the distance between a point and a line segment defined by two points.
 * The second component of the returned vector is the t parameter of the projection to find the nearest point on the line: meaning 0 for a, 1 for b, and anything in between for the line.
 */
vec2 distanceToLine(vec2 x, vec2 a, vec2 b) {
	vec2 Ab = b - a;
	vec2 Ax = x - a;
	float Ab2 = dot(Ab, Ab);
	float AbAx = dot(Ab, Ax);
	float t = clamp(AbAx / Ab2, 0.0, 1.0);
	vec2 closestPointOnLine = a + t * Ab;
	return vec2(distance(x, closestPointOnLine), t);
}	