<script lang="ts" generics="Parameters extends {} = {}">
	import { getContext, type Snippet } from 'svelte'
	import { dvContext, type IDockviewContext } from './utils'

	const { name, children }: { name: string; children?: Snippet<[Record<string, any>]> } = $props()
	const ctx = getContext<IDockviewContext>(dvContext)
	if (!ctx) throw new Error('DockView: DvComponent must be used inside DockView')
	console.assert(!!children, 'DockView: DvComponent registers no children')
	if (children) ctx.registerComponent(name, children)
</script>
