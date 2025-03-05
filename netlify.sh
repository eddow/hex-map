#!/bin/bash

git submodule update --init --depth 1
pnpm run build:all
cp -r ./packages/hexaboard/dist/assets/* ./apps/hexagame/build/assets