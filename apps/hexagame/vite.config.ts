import { paraglide } from '@inlang/paraglide-sveltekit/vite'
import svg from '@poppanator/sveltekit-svg'
import { sveltekit } from '@sveltejs/kit/vite'
import watcher from 'rollup-plugin-watcher'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		watcher(['../hexaboard/dist', '../dockview-svelte/dist']),
		sveltekit(),
		svg(),
		paraglide({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
		}),
	],
})
