<script lang="ts">
	import type { GameXLand } from '$lib/game.ts'
	import { games } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'
	import { cartesian, type AxialKey } from 'hexaboard'

	let { game: gameKey, hKey }: { game: string; hKey: AxialKey } = $props()
	let land = $derived(games[gameKey].land) as GameXLand
	let tile = $derived(land.tile(hKey))
	let terrainTypeName = $derived(tile.terrain)
	function goTo() {
		const camera = games[gameKey].views.keys().next().value?.camera
		if (!camera) return
		camera.position.copy({ ...cartesian(hKey, 20), z: camera.position.z })
		camera.updateMatrixWorld()
	}
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
	<Button onclick={goTo}>
		<EyeOutline class="w-6 h-6" />
	</Button>
	<p>{hKey}</p>
</div>
