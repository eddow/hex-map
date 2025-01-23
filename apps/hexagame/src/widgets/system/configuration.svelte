<script lang="ts">
	import DarkMode from '$lib/dark-mode.svelte'
	import { configuration, dockview } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	let darkMode = $state(configuration.darkMode)

	$effect(() => {
		configuration.darkMode = darkMode
	})

	$effect(() => {
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})
	function resetLayout() {
		const api = dockview.api
		for (const group of [...api.groups]) if (group.panels.length === 0) api.removeGroup(group)
	}
</script>

<Button onclick={resetLayout}>Reset layout</Button>
<DarkMode bind:darkMode />
