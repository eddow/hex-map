import flowbitePlugin from 'flowbite/plugin'
import type { Config } from 'tailwindcss'

export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte-icons/**/*.{html,js,svelte,ts}',
		//monorepo
		'../../node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
		'../../node_modules/flowbite-svelte-icons/**/*.{html,js,svelte,ts}',
	],
	darkMode: 'selector',
	theme: {
		extend: {
			colors: {
				// flowbite-svelte
				primary: {
					'50': '#fafaf9',
					'100': '#f5f5f4',
					'200': '#e7e5e4',
					'300': '#d6d3d1',
					'400': '#a8a29e',
					'500': '#78716c',
					'600': '#57534e',
					'700': '#44403c',
					'800': '#292524',
					'900': '#1c1917',
				},
			},
		},
	},

	plugins: [flowbitePlugin],
} satisfies Config
