import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

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
	plugins: [
		// @ts-expect-error: ...() is not a `PluginOption` but a `vite.Plugin`
		dts({
			insertTypesEntry: true,
			copyDtsFiles: true,
			include: ['src/dts.d.ts', 'src/**/*.ts', 'src/**/*.d.ts'],
		}),
	],
	resolve: {
		alias: {
			'~': resolve(__dirname, 'src'),
		},
	},
})
