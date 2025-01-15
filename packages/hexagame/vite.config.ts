import { paraglide } from '@inlang/paraglide-sveltekit/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import watcher from 'rollup-plugin-watcher'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		watcher(['../hexaboard/src', '../dockview-svelte/src/lib']),
		sveltekit(),
		paraglide({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
		}),
	],
})
