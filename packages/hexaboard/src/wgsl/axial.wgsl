override tileSize: f32 = 1.0;

const sqrt3: f32 = sqrt(3.0);
const axialTransform = mat2x2f(
	sqrt3, 0.0,
	sqrt3 / 2.0, 1.5
);

fn cartesian(axial: vec2f) -> vec2f {
	return (axialTransform * axial) * tileSize; 
}
