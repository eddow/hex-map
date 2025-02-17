<script lang="ts">
	import { game } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'
	import { cartesian, vector3from, type AxialKey } from 'hexaboard'

	let { hKey }: { game: string; hKey: AxialKey } = $props()
	let land = $derived(game!.land)
	let tile = $derived(land.tile(hKey))
	let terrainTypeName = $derived(tile.terrain)
	function goTo() {
		const camera = game!.gameView.camera
		if (!camera) return
		camera.position = vector3from({ ...cartesian(hKey, 20), y: camera.position.y })
	}
</script>

<div class="tile-info">
	<h1>{terrainTypeName}</h1>
	<Button onclick={goTo}>
		<EyeOutline class="w-6 h-6" />
	</Button>
	<p>{hKey}</p>
</div>
