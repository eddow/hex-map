<script lang="ts">
	import { DockviewApi } from 'dockview-core'
	import { DockView, DvComponent } from 'dockview-svelte'
	import { onMount } from 'svelte'
	import { tl } from 'hexaboard'

	let api: DockviewApi | undefined = $state.raw()
	let ids = 0
	function addComp() {}
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
		//addComp()
		tl()
	})
</script>

<div class="screen">
	<div class="toolbar">
		<button onclick={addComp}>Comp</button>
		<button onclick={addDvComp}>dvComp</button>
		<button onclick={addSnippet}>Snippet</button>
	</div>
	{#snippet testSnippet(t1: string, t2: string)}
		snippet test -{t1}||{t2}-- ups
	{/snippet}
	<div class="content">
		<DockView theme="dark" bind:api snippets={{ testSnippet }}>
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
