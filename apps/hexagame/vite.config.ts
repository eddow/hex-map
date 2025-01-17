import { paraglide } from '@inlang/paraglide-sveltekit/vite'
import svg from '@poppanator/sveltekit-svg'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		sveltekit(),
		svg(),
		paraglide({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
		}),
	],
})
