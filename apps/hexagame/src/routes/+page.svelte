<script lang="ts">
	import { configuration, dockview } from '$lib/globals.svelte'
	import { DockviewApi } from 'dockview-core'
	import { DockView } from 'dockview-svelte'
	import { Toolbar, ToolbarButton, ToolbarGroup } from 'flowbite-svelte'
	import { AdjustmentsHorizontalOutline, FloppyDiskAltOutline } from 'flowbite-svelte-icons'
	import * as m from '$lib/paraglide/messages'
	import { onMount } from 'svelte'
	import createGameViewRenderer from '$lib/view-panel'
	import * as widgets from '$widgets'
	import { games } from '$lib/globals.svelte'

	$effect(() => {
		return () => {
			for (const game of Object.values(games)) game.disengageAll()
		}
	})

	let api: DockviewApi = $derived(dockview.api)
	function gotApi(api: DockviewApi) {
		dockview.api = api
	}
	function showSystem(widget: 'configuration' | 'games') {
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
	const layoutJson = localStorage.getItem('layout')
	onMount(() => {
		if (layoutJson) api.fromJSON(JSON.parse(layoutJson))
		else showSystem('configuration')()
	})
	$effect(() => {
		const disposable = api.onDidLayoutChange(() => {
			const layout = api.toJSON()
			localStorage.setItem('layout', JSON.stringify(layout))
		})

		return () => disposable.dispose()
	})
</script>

<div class="screen bg-white dark:bg-gray-900">
	<Toolbar>
		<ToolbarGroup>
			<ToolbarButton onclick={showSystem('configuration')} title={m.configuration()}>
				<AdjustmentsHorizontalOutline class="w-6 h-6" />
			</ToolbarButton>
			<ToolbarButton onclick={showSystem('games')} title={m.games()}>
				<FloppyDiskAltOutline class="w-6 h-6" />
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

	.content {
		flex: 1;
	}
</style>
