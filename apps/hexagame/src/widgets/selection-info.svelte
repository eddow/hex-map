<script lang="ts">
	import { games } from '$lib/globals.svelte'
	import { terrainTypes } from '$lib/world/terrain'
	import type { Game, HeightPowGen, HexSector, MonoSectorLand } from 'hexaboard'

	// TODO: to give the sector as argument hangs in an infinite loop
	let { hexIndex }: { hexIndex?: number } = $props()
	const land = games.GameX.land as MonoSectorLand
	const sector = land.sector as HeightPowGen
	let point = sector.tiles[hexIndex!]
	let terrainTypeName = $derived(
		point ? Object.entries(terrainTypes).find(([k, v]) => v === point.type)?.[0] : 'unknown'
	)
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
</div>
