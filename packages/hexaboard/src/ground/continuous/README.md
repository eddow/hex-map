## ContinuousTextureLandscape

Takes a `TileTextureStyle` to determine how textures are managed. It contains:
- `weightMix: string`
This is a GLSL definition of the function `bary2weights` that takes a "barycentric" vector and returns a vector of weights
- `texturePosition(terrain: Terrain, point: Axial): TexturePosition`
This takes a terrain definition (the object associated with a terrain type name) and the coordinates of the point to generate which part of the texture is rendered for a tile

### Hard coded

- `textureStyle.unique`: The texture is one hexagon always drawn as-is and there is no mixing (the border is boolean: it's one tile or the other)
- `textureStyle.seamless(degree: number, seed: number)`: When using seamless textures, the textures are mixed with a polynomial gradient (the higher the degree, the shorter the transition) and the position in the whole texture is picked randomly for each point