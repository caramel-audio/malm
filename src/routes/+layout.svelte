<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import InfoModal from '$lib/components/InfoModal.svelte';
	import { browser } from '$app/environment';

	let { children } = $props();

	const VISITED_KEY = 'malm_visited';
	let showSplash = $state(browser ? !localStorage.getItem(VISITED_KEY) : false);

	function handleClose() {
		showSplash = false;
		localStorage.setItem(VISITED_KEY, '1');
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showSplash}
	<InfoModal onclose={handleClose} />
{/if}

<div class="min-h-screen bg-gray-950 text-gray-100 font-mono text-[13px]">
	{@render children()}
</div>
