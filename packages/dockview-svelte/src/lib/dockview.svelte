<script lang="ts">
	import 'dockview-core/dist/styles/dockview.css'
	import { ContentRenderer, dvContext } from './utils'
	import {
		type DockviewApi,
		type DockviewOptions,
		createDockview,
		type IContentRenderer,
		type CreateComponentOptions
	} from 'dockview-core'
	import { onMount, setContext, type Component, type Snippet } from 'svelte'
	import DvSnippet from './dv-snippet.svelte'

	let {
		components = {},
		api = $bindable(undefined),
		theme = 'light',
		onready,
		children,
		snippets = {},
		renderers = {},
		...props
	}: DockviewOptions & {
		components?: Record<string, Component>
		snippets?: Record<string, Snippet<any>>
		renderers?: Record<string, (id: string) => IContentRenderer>
		api?: DockviewApi
		theme?: 'dark' | 'light' | 'vs' | 'abyss' | 'dracula' | 'replit'
		onready?: (api: DockviewApi) => void
		children?: Snippet
	} = $props()

	// Content defined components
	const cdc: Record<string, Snippet> = {}
	setContext(dvContext, {
		registerComponent(name: string, snippet: Snippet) {
			cdc[name] = snippet
		}
	})
	/*	No need to extract programmatically as it was decomposed
	function extractCoreOptions(props: DockviewOptions): DockviewOptions {
		const coreOptions = (PROPERTY_KEYS_DOCKVIEW as (keyof DockviewOptions)[]).reduce((obj, key) => {
			;(obj as any)[key] = props[key]
			return obj
		}, {} as Partial<DockviewOptions>)

		return coreOptions as DockviewOptions
	}*/

	let el: HTMLDivElement
	$effect(() => {
		api?.updateOptions?.(props)
	})
	onMount(() => {
		api = createDockview(el, {
			...props,
			createComponent({ id, name }: CreateComponentOptions): IContentRenderer {
				if (components[name]) return new ContentRenderer(id, components[name])
				if (cdc[name]) return new ContentRenderer(id, DvSnippet, { snippet: cdc[name] })
				if (snippets[name]) return new ContentRenderer(id, DvSnippet, { snippet: snippets[name] })
				if (renderers[name]) return renderers[name](id)
				throw new Error(`DockView: Component ${name} not found`)
			}
		})
		onready?.(api)
	})
</script>

{#if children}<div style="display: none">{@render children()}</div>{/if}
<div class={`dockview dockview-theme-${theme}`} bind:this={el}></div>

<style>
	.dockview {
		width: 100%;
		height: 100%;
	}
</style>
