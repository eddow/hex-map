<script lang="ts">
	import { configuration, dockview } from '$lib/globals.svelte'
	import { DockviewApi } from 'dockview-core'
	import { DockView, DvComponent } from 'dockview-svelte'
	import Configuration from '$widgets/system/configuration.svelte'
	import Games from '$widgets/system/games.svelte'
	import { Toolbar, ToolbarButton, ToolbarGroup, Button } from 'flowbite-svelte'
	import { AdjustmentsHorizontalOutline, FloppyDiskAltOutline } from 'flowbite-svelte-icons'
	import * as m from '$lib/paraglide/messages'
	import { onMount } from 'svelte'
	import createGameViewRenderer from '$lib/view-panel'
	import TileInfo from '$widgets/tile-info.svelte'

	let api: DockviewApi = $derived(dockview.api)
	let ids = 0
	const components = {
		configuration: Configuration,
		games: Games,
		tileInfo: TileInfo
	}

	function gotApi(api: DockviewApi) {
		dockview.api = api
	}
	function addComp() {}
	function addDvComp() {
		api.addPanel({
			id: 'dct' + ids++,
			component: 'dc-test'
		})
	}
	function showSystem(widget: 'configuration' | 'games') {
		return () => {
			const id = `system.${widget}`
			let panel = api.getPanel(`system.${widget}`)
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
		<Button onclick={addComp}>Comp</Button>
		<button onclick={addDvComp}>dvComp</button>
	</Toolbar>
	{#snippet testSnippet(t1: string, t2: string)}
		snippet test -{t1}||{t2}-- ups
	{/snippet}
	<div class="content">
		<DockView
			theme={configuration.darkMode ? 'dracula' : 'light'}
			renderers={{ gameView: createGameViewRenderer }}
			onready={gotApi}
			snippets={{ testSnippet }}
			{components}
		>
			<DvComponent name="dc-test">DvComponent test</DvComponent>
		</DockView>
	</div>
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
