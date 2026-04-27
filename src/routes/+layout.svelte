<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import SplashScreen from '$lib/components/SplashScreen.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<SplashScreen />

<div class="min-h-screen bg-gray-950 text-gray-100 font-mono text-[13px]">
	{@render children()}
</div>
