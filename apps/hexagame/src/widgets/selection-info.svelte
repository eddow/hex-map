<script lang="ts">
	import type { GameXLand } from '$lib/game.ts'
	import { games } from '$lib/globals.svelte'
	import type { HexKey } from 'hexaboard'

	let { game: gameKey, hKey }: { game: string; hKey: HexKey } = $props()
	let land = $derived(games[gameKey].land) as GameXLand
	let tile = $derived(land.getTile(hKey))
	let terrainTypeName = $derived(tile.terrain)
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
</div>
