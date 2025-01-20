# dockview-svelte

Interface to use [dockview](https://dockview.dev/) in Svelte.

## Installation

```bash
npm install dockview-svelte
```

## Usage

```svelte
<script>
	import { DockView } from 'dockview-svelte';
	import TestComponent from '$lib/test.component.svelte'
	
	let api: DockviewApi | undefined = $state.raw()
	let ids = 0
	function addComp() {
		api?.addPanel({
			id: 'test' + ids++,
			component: 'TestComponent',
			params: {
				text: 'param-test' + ids
			}
		})
	}
	function addDvComp() {
		api?.addPanel({
			id: 'dct' + ids++,
			component: 'DvWidget'
		})
	}
	function addSnippet() {
		api?.addPanel({
			id: 'snippet' + ids++,
			component: 'TestSnippet',
			params: {
				parameters: ['param-test1', 'param-test2'],
			}
		})
	}
</script>

{#snippet TestSnippet(t1: string, t2: string)}
	snippet test -{t1}||{t2}-- ups
{/snippet}
<DockView
	bind:api 
	widgets={{ TestComponent }}
	snippets={{ TestSnippet }}
>
	<DvWidget name="DvWidget">DvWidget test</DvWidget>
</DockView>
```