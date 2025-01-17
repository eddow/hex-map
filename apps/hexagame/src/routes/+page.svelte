<script lang="ts">
	import { configuration } from '../globals.svelte.ts'
	import { DockviewApi } from 'dockview-core'
	import { DockView, DvComponent } from 'dockview-svelte'
	import Configuration from '../widgets/configuration.svelte'
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Button } from 'flowbite-svelte'
	import { AdjustmentsHorizontalOutline } from 'flowbite-svelte-icons'
	import * as m from '$lib/paraglide/messages'
	import { onMount } from 'svelte'
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
	const layoutJson = localStorage.getItem('layout')
	onMount(() => {
		if (layoutJson) api.fromJSON(JSON.parse(layoutJson))
		else showConfig()
	})
	$effect(() => {
		const disposable = api.onDidLayoutChange(() => {
			const layout = api.toJSON()
			localStorage.setItem('layout', JSON.stringify(layout))
		})

		return () => disposable.dispose()
	})
</script>

<div class="screen">
	<Navbar>
		<Button color="primary" onclick={showConfig} title={m.configuration()}>
			<AdjustmentsHorizontalOutline class="w-6 h-6" />
		</Button>
		<button
			class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
			onclick={addComp}>Comp</button
		>
		<button onclick={addDvComp}>dvComp</button>
		<button onclick={addSnippet}>Snippet</button>
	</Navbar>
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

	.content {
		flex: 1;
	}
</style>
