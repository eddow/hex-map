<script lang="ts">
	import DarkMode from '$lib/dark-mode.svelte'
	import { configuration, dockview } from '$lib/globals.svelte'
	import { Alert, Button } from 'flowbite-svelte'
	let darkMode = $state(configuration.darkMode)

	$effect(() => {
		configuration.darkMode = darkMode
	})

	$effect(() => {
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})
</script>

<DarkMode bind:darkMode />
<Alert>
	<p>Wheel = zoom + look-at</p>
	<p>Both left+right down = pan</p>
	<a href="https://github.com/eddow/hex-map" target="_blank">https://github.com/eddow/hex-map</a>
</Alert>
