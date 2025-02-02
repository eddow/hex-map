<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { SunSolid, MoonSolid } from 'flowbite-svelte-icons'
	let {
		darkMode = $bindable(false),
		class: className = ''
	}: { darkMode?: boolean; class?: string } = $props()
</script>

<Button
	class="{className} text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xl p-2"
	aria-label="Toggle dark mode"
	type="button"
	onclick={() => (darkMode = !darkMode)}
>
	<MoonSolid class={`w-6 h-6 bg-gray-100 ${darkMode ? 'hidden' : ''}`} />
	<SunSolid class={`w-6 h-6 bg-gray-700 ${darkMode ? '' : 'hidden'}`} />
</Button>
