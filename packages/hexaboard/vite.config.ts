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
		minify: false,
		target,
		sourcemap: true,
		lib: {
			entry: {
				hexaboard: resolve(__dirname, 'src/main.ts'),
				'vite-plugin': resolve(__dirname, 'src/vite-plugin.ts'),
			},
			name: 'HexaBoard',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			// make sure to externalize deps that shouldn't be bundled
			// into your library
			external: ['three', 'node:fs', 'node:path'],
			output: {
				globals: {
					three: 'THREE',
				},
			},
		},
	},
	plugins: [
		dts({
			insertTypesEntry: true,
			copyDtsFiles: true,
			include: ['src/dts.d.ts', 'src/**/*.ts', 'src/**/*.d.ts'],
		}),
	],
	resolve: {
		alias: {
			'~': resolve(__dirname, 'src'),
			webgpgpu: resolve(__dirname, 'node_modules/webgpgpu.ts'),
		},
	},
})
