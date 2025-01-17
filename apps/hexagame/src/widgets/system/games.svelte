<script lang="ts">
	import { Vector3 } from 'three'
	import { Button } from 'flowbite-svelte'
	import { dockview, games } from '../../globals.svelte'
	import { Game, Island, LCG, MonoSectorLand } from 'hexaboard'

	function createGame() {
		/*
		const worldSeed = Math.random()
		const land = new MonoSectorLand(new Island(new Vector3(0, 0, 0), 10, 6))
		land.generate(LCG(worldSeed))
		land.virgin()
		land.mesh()
		games.GameX = new Game(land)
		*/
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
