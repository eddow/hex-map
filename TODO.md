# TODO

- network/server management?
- rivers & better terrains
- https://threejs.org/docs/#api/en/objects/LOD , even for sectors?

## Big optimizations

- Add sectors :"> - for ray tracing/hitboxes, LOD
- No more "pre-render" for MeshPaste: keep the list up to date

## Grok Formulas

### Walking time

```ts
/**
 * Calculates walking time with slope
 * @param H Horizontal distance in meters
 * @param T Time for flat walk
 * @param dH Vertical change in meters
 * @returns walking time
 */
function calculateWalkingTimeWithSlope(H: number, T: number, dH: number): number {
    // Flat land speed in meters per minute
    const flatSpeed = H / T;
    
    // Time for flat land distance
    let totalTime = T; // minutes
    
    // Calculate slope (in radians)
    const slope = Math.atan(Math.abs(dH) / H);

    // Adjust for elevation
    if (dH > 0) { // uphill
        // Exponential increase for uphill, where slope significantly affects time
        totalTime += dH * (1 + Math.exp(slope - 0.15)) * 0.75;
    } else if (dH < 0) { // downhill
        // Quadratic increase for downhill, reflecting increased caution
        totalTime += Math.abs(dH) * (0.5 + 0.25 * Math.pow(slope, 2));
    }
    
    return totalTime; // total time in minutes
}
```
