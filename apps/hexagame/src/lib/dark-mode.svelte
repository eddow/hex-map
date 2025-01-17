<script lang="ts">
	import Sun from 'heroicons/24/solid/sun.svg?component'
	import Moon from 'heroicons/24/solid/moon.svg?component'
	let { darkMode = $bindable(false) } = $props()
</script>

<button
	class="inline-flex items-center p-2 text-gray-500 rounded-lg dark:text-gray-400 bg-gray-700 dark:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700"
	aria-label="Toggle dark mode"
	type="button"
	onclick={() => (darkMode = !darkMode)}
>
	<Moon class={['w-6 h-6 bg-gray-700', darkMode ? 'hidden' : '']} />
	<Sun class={['w-6 h-6 bg-gray-100', darkMode ? '' : 'hidden']} />
</button>
