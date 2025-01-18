<script lang="ts" generics="Parameters extends [] = []">
	import type { Snippet } from 'svelte'

	const { snippet, parameters }: { snippet: Snippet<[Parameters]>; parameters: Parameters } =
		$props()
	function doSnippet(anchor?: any) {
		return (snippet as (...args: any[]) => any).apply(
			null,
			parameters ? [anchor, ...parameters.map((p) => () => p)] : [anchor]
		)
	}
</script>

{@render doSnippet()}
