import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		target: 'esnext',
		sourcemap: true,
	},
	esbuild: {
		target: 'esnext',
		sourcemap: true,
	},
})
