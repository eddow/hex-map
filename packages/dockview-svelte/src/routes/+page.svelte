<script lang="ts">
	import type { DockviewApi } from 'dockview-core'
	import Dockview from './../lib/dockview.svelte'
	import TestComponent from '$lib/test.component.svelte'
	import { onMount } from 'svelte'
	import DvWidget from '$lib/dv-widget.svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'

	let api: DockviewApi | undefined = $state.raw()
	let ids = 0
	function addComp() {
		api?.addPanel({
			id: 'test' + ids++,
			component: 'Tc',
			params: {
				text: 'param-test' + ids
			}
		})
	}
	function addDvComp() {
		api?.addPanel({
			id: 'dct' + ids++,
			component: 'dc-test'
		})
	}
	function addSnippet() {
		api?.addPanel({
			id: 'snip' + ids++,
			component: 'testSnippet',
			params: { parameters: ['tp-t1', 'tp-t2'] },
			floating: true
		})
	}
	onMount(() => {
		addComp()
	})
</script>

<div class="screen">
	<div class="toolbar">
		<button id="addComp" onclick={addComp}>Comp</button>
		<button id="addDvComp" onclick={addDvComp}>dvComp</button>
		<button id="addSnippet" onclick={addSnippet}>Snippet</button>
	</div>
	{#snippet testSnippet(t1: string, t2: string)}
		snippet test -{t1}||{t2}-- ups
	{/snippet}
	<div class="content">
		<Dockview
			bind:api
			widgets={{ Tc: TestComponent }}
			snippets={{ testSnippet }}
			singleTabMode="fullwidth"
		>
			<DvWidget name="dc-test">DvComponent test</DvWidget>
		</Dockview>
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

	:global(.content) {
		flex: 1;
	}
</style>
