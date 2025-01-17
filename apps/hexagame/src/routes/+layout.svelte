<script lang="ts">
	import '../app.css'
	import { i18n } from '$lib/i18n'
	import { ParaglideJS } from '@inlang/paraglide-sveltekit'
	import { configuration } from '../globals.svelte'
	let { children } = $props()

	$effect(() => {
		if (configuration.darkMode) document.documentElement.classList.add('dark')
		else document.documentElement.classList.remove('dark')
	})
</script>

<ParaglideJS {i18n}>
	{@render children()}
</ParaglideJS>
