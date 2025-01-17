<script lang="ts">
	import { Button } from 'flowbite-svelte'
	import { dockview } from '$lib/globals.svelte'

	function createGame() {
		dockview.api.addPanel({
			id: `game.GameX`,
			component: 'gameView',
			params: {
				game: 'GameX'
			},
			position: {
				direction: 'right'
			}
		})
	}
</script>

<Button onclick={createGame}>New game</Button>
