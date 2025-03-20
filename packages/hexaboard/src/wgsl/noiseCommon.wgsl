/**
 * Remap the input value to exaggerate a bit the extreme values while letting median values quite flat
 * @param f The input value between 0 and 1
 * @param k A parameter that controls how much the extreme values are amplified. (cf. [image](./atan_remap_inverse.png))
 */
fn atan_remap_inverse(f: f32, k: f32) -> f32 {
    return mix(0.0, 1.0, 0.5 + tan(3.141592 * (f - 0.5)) / k);
}