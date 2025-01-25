# TODO

- network/server management?
- rivers & better terrains
- https://threejs.org/docs/#api/en/objects/LOD , even for sectors?
- BatchedMesh for sectors - but: little optimization & perhaps raycast cannot recognize instances

## Big optimizations

- remove sectors concepts!!
- No more "pre-render" for MeshPaste: keep the list up to date

## Grok Formulas

### Hexagons within a distance

```ts
function hexagonsWithinDistance(P: [number, number], D: number): [number, number][] {
    const [q, r] = P; // Axial coordinates of point P
    const maxDistance = Math.ceil(D / Math.sqrt(3));
    const hexagons: [number, number][] = [];

    for (let dq = -maxDistance; dq <= maxDistance; dq++) {
        // Optimize by only checking relevant dr values for each dq
        const startDr = Math.max(-max_distance, -dq - maxDistance);
        const endDr = Math.min(max_distance, -dq + maxDistance);
        
        for (let dr = startDr; dr <= endDr; dr++) {
            // Check hexagonal distance only if within our Cartesian approximation
            if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) <= maxDistance) {
                hexagons.push([q + dq, r + dr]);
            }
        }
    }
    
    return hexagons;
}
```

## Walking time

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