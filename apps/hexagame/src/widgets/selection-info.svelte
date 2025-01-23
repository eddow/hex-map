<script lang="ts">
	import { games } from '$lib/globals.svelte'
	import { terrainTypes } from '$lib/world/terrain'
	import type { PuzzleLand } from 'hexaboard'

	let {
		game: gameKey,
		sector: sectorKey,
		hexIndex
	}: { game: string; sector: string; hexIndex: number } = $props()
	const game = games[gameKey!]
	const land = game.land as PuzzleLand
	const sector = land.sector(sectorKey!)
	let tile = sector.tiles[hexIndex!]
	let terrainTypeName = $derived(
		tile ? Object.entries(terrainTypes).find(([k, v]) => v === tile.terrain)?.[0] : 'unknown'
	)
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
</div>
