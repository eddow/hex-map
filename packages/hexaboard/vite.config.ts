import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
	root: './',

	build: {
		target: 'modules', // Adjust target as needed
		lib: {
			entry: resolve(__dirname, 'src/main.ts'),
			name: 'HexaBoard',
			fileName: 'hexaboard',
			formats: ['es', 'umd'],
		},
	},
	// @ts-ignore: dts() is not a `PluginOption` but a `vite.Plugin`
	plugins: [dts()],
	optimizeDeps: {
		exclude: ['three'], // Example for including external dependencies
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, 'src'),
		},
	},
})
