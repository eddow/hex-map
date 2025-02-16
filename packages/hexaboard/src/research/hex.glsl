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