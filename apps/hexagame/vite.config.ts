import { paraglide } from '@inlang/paraglide-sveltekit/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

// Transform decorators but let the remaining untouched
const target = 'es2023'
export default defineConfig({
	plugins: [
		sveltekit(),
		paraglide({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
		}),
	],
	build: {
		target,
	},
	esbuild: {
		target,
	},
})
