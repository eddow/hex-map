import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [
		vitePreprocess({
			babel: {
				presets: [
					['@babel/preset-env', { targets: { esmodules: true } }],
					'@babel/preset-typescript',
				],
				plugins: [['@babel/plugin-proposal-decorators', { loose: true, version: '2023-11' }]],
			},
		}),
	],

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			// TODO make it work from built library
			hexaboard: '../../packages/hexaboard/src/main.ts',
			'~/*': '../../packages/hexaboard/src/*',
			'dockview-svelte': '../../packages/dockview-svelte/src/lib/index.ts',
			$widgets: 'src/widgets',
		},
	},
}

export default config
