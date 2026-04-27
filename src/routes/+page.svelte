<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import Results from '$lib/components/Results.svelte';
	import { togglePlayPause } from '$lib/audio/playback.svelte';

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
	<!-- Top row: Upload (left) + Options (right) -->
	<div class="flex border-b border-gray-700 h-80">
		<div class="w-2/3 border-r border-gray-700">
			<Upload />
		</div>
		<div class="w-1/3">
			<Options />
		</div>
	</div>

	<!-- Bottom: Results -->
	<div class="flex-1 overflow-y-auto">
		<Results />
	</div>
</main>
