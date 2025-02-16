vec2 hexToWorld(vec2 hex) {
    float x = sqrt(3.0) * hex.x + sqrt(3.0)/2.0 * hex.y;
    float y = 1.5 * hex.y;
    return vec2(x, y);
}

vec3 cubeRound(vec3 cube) {
    float rx = round(cube.x);
    float ry = round(cube.y);
    float rz = round(cube.z);

    float dx = abs(rx - cube.x);
    float dy = abs(ry - cube.y);
    float dz = abs(rz - cube.z);

    if (dx > dy && dx > dz) {
        rx = -ry - rz;
    } else if (dy > dz) {
        ry = -rx - rz;
    } else {
        rz = -rx - ry;
    }
    return vec3(rx, ry, rz);
}

vec3 axialToCube(vec2 hex) {
    return vec3(hex.x, hex.y, -hex.x - hex.y);
}

vec2 cubeToAxial(vec3 cube) {
    return vec2(cube.x, cube.y);
}

vec2 worldToHex(vec2 p) {
    float q = (sqrt(3.0) / 3.0 * p.x - 1.0 / 3.0 * p.y);
    float r = (2.0 / 3.0 * p.y);
    return cubeToAxial(cubeRound(axialToCube(vec2(q, r))));
}

#define NBR_RINGS 6
#define NBR_NEIGHBORS neighborRing[NBR_RINGS-1]

const int neighborRing[6] = int[6](6, 18, 36, 60, 90, 126);
const vec2 hexNeighbors[NBR_NEIGHBORS] = vec2[NBR_NEIGHBORS](
    // 🟡 Ring 0 (6 Neighbors)
    vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 0.0), vec2(0.0, -1.0), vec2(1.0, -1.0),

    // 🟡 Ring 1 (12 Neighbors, total 18)
    vec2(2.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 2.0),
    vec2(-1.0, 2.0), vec2(-2.0, 1.0), vec2(-2.0, 0.0),
    vec2(-1.0, -1.0), vec2(0.0, -2.0), vec2(1.0, -2.0),
    vec2(2.0, -1.0), vec2(2.0, 1.0), vec2(-2.0, -1.0),

    // 🟡 Ring 2 (18 Neighbors, total 36)
    vec2(3.0, 0.0), vec2(2.0, 1.0), vec2(1.0, 2.0),
    vec2(0.0, 3.0), vec2(-1.0, 3.0), vec2(-2.0, 2.0),
    vec2(-3.0, 1.0), vec2(-3.0, 0.0), vec2(-2.0, -1.0),
    vec2(-1.0, -2.0), vec2(0.0, -3.0), vec2(1.0, -3.0),
    vec2(2.0, -2.0), vec2(3.0, -1.0), vec2(3.0, 1.0),
    vec2(2.0, 2.0), vec2(1.0, 3.0), vec2(-1.0, -3.0),

    // 🟡 Ring 3 (24 Neighbors, total 60)
    vec2(4.0, 0.0), vec2(3.0, 1.0), vec2(2.0, 2.0),
    vec2(1.0, 3.0), vec2(0.0, 4.0), vec2(-1.0, 4.0),
    vec2(-2.0, 3.0), vec2(-3.0, 2.0), vec2(-4.0, 1.0),
    vec2(-4.0, 0.0), vec2(-3.0, -1.0), vec2(-2.0, -2.0),
    vec2(-1.0, -3.0), vec2(0.0, -4.0), vec2(1.0, -4.0),
    vec2(2.0, -3.0), vec2(3.0, -2.0), vec2(4.0, -1.0),
    vec2(4.0, 1.0), vec2(3.0, 2.0), vec2(2.0, 3.0),
    vec2(1.0, 4.0), vec2(-1.0, -4.0), vec2(-2.0, -3.0),

    // 🟡 Ring 4 (30 Neighbors, total 90)
    vec2(5.0, 0.0), vec2(4.0, 1.0), vec2(3.0, 2.0),
    vec2(2.0, 3.0), vec2(1.0, 4.0), vec2(0.0, 5.0),
    vec2(-1.0, 5.0), vec2(-2.0, 4.0), vec2(-3.0, 3.0),
    vec2(-4.0, 2.0), vec2(-5.0, 1.0), vec2(-5.0, 0.0),
    vec2(-4.0, -1.0), vec2(-3.0, -2.0), vec2(-2.0, -3.0),
    vec2(-1.0, -4.0), vec2(0.0, -5.0), vec2(1.0, -5.0),
    vec2(2.0, -4.0), vec2(3.0, -3.0), vec2(4.0, -2.0),
    vec2(5.0, -1.0), vec2(5.0, 1.0), vec2(4.0, 2.0),
    vec2(3.0, 3.0), vec2(2.0, 4.0), vec2(1.0, 5.0),
    vec2(-1.0, -5.0), vec2(-2.0, -4.0), vec2(-3.0, -3.0),

    // 🟡 Ring 5 (36 Neighbors, total 126)
    vec2(6.0, 0.0), vec2(5.0, 1.0), vec2(4.0, 2.0),
    vec2(3.0, 3.0), vec2(2.0, 4.0), vec2(1.0, 5.0),
    vec2(0.0, 6.0), vec2(-1.0, 6.0), vec2(-2.0, 5.0),
    vec2(-3.0, 4.0), vec2(-4.0, 3.0), vec2(-5.0, 2.0),
    vec2(-6.0, 1.0), vec2(-6.0, 0.0), vec2(-5.0, -1.0),
    vec2(-4.0, -2.0), vec2(-3.0, -3.0), vec2(-2.0, -4.0),
    vec2(-1.0, -5.0), vec2(0.0, -6.0), vec2(1.0, -6.0),
    vec2(2.0, -5.0), vec2(3.0, -4.0), vec2(4.0, -3.0),
    vec2(5.0, -2.0), vec2(6.0, -1.0), vec2(6.0, 1.0),
    vec2(5.0, 2.0), vec2(4.0, 3.0), vec2(3.0, 4.0),
    vec2(2.0, 5.0), vec2(1.0, 6.0), vec2(-1.0, -6.0),
    vec2(-2.0, -5.0), vec2(-3.0, -4.0), vec2(-4.0, -3.0)
);
