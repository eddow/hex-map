import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	// @ts-expect-error returns a promise, not a plugin
	plugins: [sveltekit()],
})
