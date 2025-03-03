# Hexa-game

Sand-boxing tool for strategical hexagonal board games.

The idea is to have room to write terrain generation (and show it), a 3D environment with mouse events on the 3D entities, an easy way to add an UI (svelte) and ways to sandbox ideas on that topic

[Demo](https://hexboard.netlify.app/)

## Installation

### webgpgpu

`package/webgpgpu` is a submodule, so clone with `--recurse-submodules` or, after cloning:
```bash
git submodule update --init --recursive
```
Fetch last version:
```bash
git submodule update --remote --recursive
```

### apps/hexagame

`pnpm i` blah blah

> Build `packages/hexaboard` *before* trying `apps/hexagame` ! (it contains a vite plugin)