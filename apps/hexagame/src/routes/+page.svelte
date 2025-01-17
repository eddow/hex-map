<script lang="ts">
	import { configuration } from '../stores/config.svelte.ts'
	import { DockviewApi } from 'dockview-core'
	import { DockView, DvComponent } from 'dockview-svelte'
	import Configuration from '../widgets/configuration.svelte'
	import ConfigIcon from 'heroicons/24/outline/adjustments-horizontal.svg?component'
	import * as m from '$lib/paraglide/messages'

	$effect(() => {
		document.documentElement.setAttribute('data-mode', configuration.darkMode ? 'dark' : 'light')
	})
	let api: DockviewApi = $state.raw({} as DockviewApi)
	let ids = 0
	const components = {
		Configuration
	}
	function addComp() {}
	function addDvComp() {
		api.addPanel({
			id: 'dct' + ids++,
			component: 'dc-test'
		})
	}
	function addSnippet() {
		api.addPanel({
			id: 'snip' + ids++,
			component: 'testSnippet',
			params: { parameters: ['tp-t1', 'tp-t2'] },
			floating: true
		})
	}

	function showConfig() {
		let panel = api.getPanel('configuration')
		if (panel) panel.api.setActive()
		else {
			panel = api.addPanel({
				id: 'configuration',
				component: 'Configuration',
				title: m.configuration(),
				floating: true
			})
		}
	}
</script>

<div class="screen">
	<div class="toolbar bg-gray-100 dark:bg-gray-700">
		<button
			class="bg-blue-500 dark:bg-blue-700 text-white font-bold py-0 px-0 rounded"
			onclick={showConfig}
			title={m.configuration()}
		>
			<ConfigIcon class="w-6 h-6" />
		</button>
		<button
			class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
			onclick={addComp}>Comp</button
		>
		<button onclick={addDvComp}>dvComp</button>
		<button onclick={addSnippet}>Snippet</button>
	</div>
	{#snippet testSnippet(t1: string, t2: string)}
		snippet test -{t1}||{t2}-- ups
	{/snippet}
	<div class="content">
		<DockView
			theme={configuration.darkMode ? 'dracula' : 'light'}
			bind:api
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
	.toolbar {
		width: 100%;
		height: 50px;
	}

	.content {
		flex: 1;
	}
</style>
