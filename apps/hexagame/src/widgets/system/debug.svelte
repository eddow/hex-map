<script lang="ts">
	import { debugInfo } from '$lib/globals.svelte'
	import {
		Button,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHeadCell
	} from 'flowbite-svelte'

	function debugged(value: any) {
		if (typeof value === 'number') return value.toFixed(2)
		if (typeof value !== 'object') return value
		if (!value) return '' + value
		return Object.entries(value)
			.map(([k, v]): string => `${k}: ${debugged(v)}`)
			.join(' | ')
	}
	let dDebugInfo = $derived(Object.entries(debugInfo).map(([k, v]) => [k, debugged(v)]))
	function resetLayout() {
		localStorage.removeItem('layout')
		location.reload()
	}
</script>

<Button class="w-full" onclick={resetLayout}>Reset layout</Button>
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
