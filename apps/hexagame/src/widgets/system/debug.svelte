<script lang="ts">
	import { debugInfo } from '$lib/globals.svelte'
	import { Table, TableBody, TableBodyCell, TableBodyRow, TableHeadCell } from 'flowbite-svelte'

	function debugged(value: any) {
		if (typeof value !== 'object') return value
		return Object.entries(value)
			.map(([k, v]): string => `${k}: ${debugged(v)}`)
			.join(' | ')
	}
	let dDebugInfo = $derived(Object.entries(debugInfo).map(([k, v]) => [k, debugged(v)]))
</script>

<Table>
	<TableBody title="Debug info">
		{#each dDebugInfo as content}
			<TableBodyRow>
				<TableHeadCell>{content[0]}</TableHeadCell>
				<TableBodyCell>{content[1]}</TableBodyCell>
			</TableBodyRow>
		{/each}
	</TableBody>
</Table>
