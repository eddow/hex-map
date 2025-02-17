import fs from 'node:fs'
import { resolve } from 'node:path'
import { paraglide } from '@inlang/paraglide-sveltekit/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import hexaboardWorkers from 'hexaboard/vite'
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
		hexaboardWorkers,
		{
			// Wait for monorepo dependant packages to be built before returning an error when HMR (don't 404 in the middle of the build)
			name: 'wait-for-monorepo',
			configureServer(server) {
				// Get `dependencies` from package.json
				const pkgJsonPath = resolve(__dirname, 'package.json')
				const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
				const dependencies = Object.keys(pkgJson.dependencies || {})
					// Get monorepo packages only (not node_modules)
					.map((dep) => {
						const target = import.meta.resolve(dep)
						// only keep internal (not `node_modules`) dependencies
						if (/\/node_modules\//.test(target)) return
						const match = target.match(/file:\/\/(.*)/)
						return match ? match[1] : undefined
					})
					.filter((dep) => !!dep) as string[]

				// Wait for each dependency to exist before serving the app
				server.middlewares.use((req, res, next) => {
					let retries = 10
					function checkFile() {
						if (dependencies.every((file) => fs.existsSync(file))) {
							next()
						} else if (retries-- > 0) {
							setTimeout(checkFile, 1500) // Wait 1.5s and check again
						} else {
							next() // After 1.5 seconds, return 404 if still missing
						}
					}
					checkFile()
				})
			},
		},
	],
	server: {
		fs: {
			allow: ['../../hexaboard/dist', '../../dockview-svelte/dist'],
		},
	},
	build: {
		target,
	},
	esbuild: {
		target,
	},
})
