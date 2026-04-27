<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import Results from '$lib/components/Results.svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';
	import { togglePlayPause } from '$lib/audio/playback.svelte';

	let showInfo = $state(false);

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
		if (event.key === ' ' || event.key === 'k') {
			event.preventDefault();
			togglePlayPause();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="flex flex-col h-screen">
	<!-- Top row: Upload (left) + Options (right) + Info (narrow) -->
	<div class="flex border-b border-gray-700 h-72">
		<div class="w-2/3 border-r border-gray-700">
			<Upload />
		</div>
		<div class="flex-1 border-r border-gray-700">
			<Options />
		</div>
		<div class="flex items-start justify-center pt-2 w-8">
			<button
				class="text-gray-500 hover:text-gray-300 text-xs font-mono leading-none w-5 h-5 flex items-center justify-center border border-gray-600 hover:border-gray-400 rounded-full"
				onclick={() => (showInfo = true)}
				aria-label="About"
			>i</button>
		</div>
	</div>

	{#if showInfo}
		<SplashScreen manual onclose={() => (showInfo = false)} />
	{/if}

	<!-- Bottom: Results -->
	<div class="flex-1 overflow-y-auto">
		<Results />
	</div>
</main>
