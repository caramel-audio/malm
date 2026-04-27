<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	let sliding = $state(false);
	let gone = $state(false);

	onMount(() => {
		setTimeout(() => {
			sliding = true;
			setTimeout(() => {
				gone = true;
			}, 500);
		}, 500);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if !gone}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950"
		style="transform: translateY({sliding ? '-100%' : '0'}); transition: transform 500ms ease-in-out;"
	>
		<span class="font-mono text-white text-8xl font-bold tracking-widest">MALM</span>
		<span class="font-mono text-gray-400 text-sm mt-4 tracking-wider">Multi audio loudness measurement</span>
	</div>
{/if}

<div class="min-h-screen bg-gray-950 text-gray-100 font-mono text-[13px]">
	{@render children()}
</div>
