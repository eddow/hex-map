<script lang="ts">
	import DarkMode from '$lib/dark-mode.svelte'
	import { configuration } from '../stores/config.svelte'
	let darkMode = $state(configuration.darkMode)
	$effect(() => {
		configuration.darkMode = darkMode
	})

	$effect(() => {
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})
</script>

<DarkMode bind:darkMode />
