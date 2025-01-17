import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: './',

	build: {
		target: 'modules', // Adjust target as needed
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
	// @ts-ignore: dts() is not a `PluginOption` but a `vite.Plugin`
	plugins: [dts()],
	resolve: {
		alias: {
			'~': resolve(__dirname, 'src'),
		},
	},
})
