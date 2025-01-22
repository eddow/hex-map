<script lang="ts">
	import DarkMode from '$lib/dark-mode.svelte'
	import { configuration, debugInfo, dockview } from '$lib/globals.svelte'
	import { Button, Table, TableBody, TableBodyCell, TableBodyRow } from 'flowbite-svelte'
	let darkMode = $state(configuration.darkMode)
	let dDebugInfo = $derived(Object.entries(debugInfo).map(([k, v]) => [k, JSON.stringify(v)]))
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
<Table>
	<TableBody title="Debug info">
		{#each dDebugInfo as content}
			<TableBodyRow>
				<TableBodyCell>{content[0]}</TableBodyCell>
				<TableBodyCell>{content[1]}</TableBodyCell>
			</TableBodyRow>
		{/each}
	</TableBody>
</Table>
