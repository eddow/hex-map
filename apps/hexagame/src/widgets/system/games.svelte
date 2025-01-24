<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { dockview } from '$lib/globals.svelte'

	function createGame() {
		dockview.api.addPanel({
			id: `game.${crypto.randomUUID()}`,
			component: 'gameView',
			title: 'Game X',
			params: {
				game: 'GameX'
			},
			position: {
				direction: 'right'
			}
		})
	}
</script>

<Button onclick={createGame}>New view</Button>
