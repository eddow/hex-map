<script lang="ts">
	import { configuration, dockview } from '$lib/globals.svelte'
	import { DockviewApi } from 'dockview-core'
	import { DockView } from 'dockview-svelte'
	import { Toolbar, ToolbarButton, ToolbarGroup } from 'flowbite-svelte'
	import {
		AdjustmentsHorizontalOutline,
		FloppyDiskAltOutline,
		BugOutline
	} from 'flowbite-svelte-icons'
	import * as m from '$lib/paraglide/messages'
	import { onMount } from 'svelte'
	import createGameViewRenderer from '$lib/view-panel'
	import * as widgets from '$widgets'
	import { games } from '$lib/globals.svelte'

	$effect(() => {
		const disposable = api.onDidLayoutChange(() => {
			const layout = api.toJSON()
			localStorage.setItem('layout', JSON.stringify(layout))
		})
		return () => {
			for (const game of Object.values(games)) {
				game.running = false
			}
			disposable.dispose()
		}
	})

	let api: DockviewApi = $derived(dockview.api)
	function gotApi(api: DockviewApi) {
		dockview.api = api
	}
	function showSystem(widget: 'configuration' | 'games' | 'debug') {
		return () => {
			const id = `system.${widget}`
			let panel = api.getPanel(id)
			if (panel) {
				if (panel.api.isActive) panel.api.close()
				else panel.api.setActive()
			} else {
				const otherSystem = api.panels.find((p) => p.id.startsWith('system.'))
				panel = api.addPanel({
					id,
					component: widget,
					title: m[widget](),
					...(otherSystem
						? {
								position: {
									direction: 'within',
									referencePanel: otherSystem
								}
							}
						: { floating: true })
				})
			}
		}
	}
	const layoutJson = false //location.host.startsWith('localhost') ? localStorage.getItem('layout') : null
	onMount(() => {
		if (layoutJson)
			try {
				api.fromJSON(JSON.parse(layoutJson))
				return
			} catch {
				localStorage.removeItem('layout')
			}
		else {
			showSystem('configuration')()

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
	})
	function preventDefault(event: MouseEvent) {
		if (event.button === 4 || event.button === 3) {
			event.preventDefault()
		}
	}
</script>

<!-- Prevent default navigation behaviors associated to buttons 3 & 4 -->
<svelte:body onmouseup={preventDefault} onmousedown={preventDefault} />
<div class="screen bg-white dark:bg-gray-900">
	<Toolbar>
		<ToolbarGroup>
			<ToolbarButton onclick={showSystem('configuration')} title={m.configuration()}>
				<AdjustmentsHorizontalOutline class="w-6 h-6" />
			</ToolbarButton>
			<ToolbarButton onclick={showSystem('games')} title={m.games()}>
				<FloppyDiskAltOutline class="w-6 h-6" />
			</ToolbarButton>
			<ToolbarButton onclick={showSystem('debug')} title={m.games()}>
				<BugOutline class="w-6 h-6" />
			</ToolbarButton>
		</ToolbarGroup>
	</Toolbar>
	<DockView
		class="content"
		theme={configuration.darkMode ? 'dracula' : 'light'}
		renderers={{ gameView: createGameViewRenderer }}
		onready={gotApi}
		{widgets}
	/>
</div>

<style>
	.screen {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	:global(.content) {
		flex: 1;
	}
</style>
