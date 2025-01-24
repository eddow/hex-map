import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import glsl from 'vite-plugin-glsl'

// Transform decorators but let the remaining untouched
const target = 'es2023'
export default defineConfig({
	root: './',
	esbuild: {
		target,
	},

	build: {
		target,
		sourcemap: true,
		lib: {
			entry: resolve(__dirname, 'src/main.ts'),
			name: 'HexaBoard',
			fileName: 'hexaboard',
			formats: ['es', 'umd'],
		},
		rollupOptions: {
			// make sure to externalize deps that shouldn't be bundled
			// into your library
			external: ['three'],
			output: {
				globals: {
					three: 'THREE',
				},
			},
		},
	},
	// @ts-expect-error: ...() is not a `PluginOption` but a `vite.Plugin`
	plugins: [dts(), glsl()],
	resolve: {
		alias: {
			'~': resolve(__dirname, 'src'),
		},
	},
})
