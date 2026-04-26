<script lang="ts">
	// Bottom panel: band selector, loudness type selector, one Plot per file
	import { files } from '$lib/state/files.svelte';
	import { results } from '$lib/state/results.svelte';
	import Plot from './Plot.svelte';

	let selectedBand = $state('full');
	let loudnessType = $state<'momentary' | 'shortTerm'>('momentary');
</script>

<section class="flex flex-col h-full">
	<!-- Controls bar -->
	<div class="flex items-center gap-4 px-3 py-2 border-b border-[#3a3a3a] text-xs">
		<label class="flex items-center gap-2 text-[#6a6a6a] uppercase tracking-widest">
			BAND
			<select bind:value={selectedBand} class="bg-[#1a1a1a] border border-[#3a3a3a] text-[#d4d0c8] px-2 py-1 uppercase">
				{#each (results.data[0]?.bands ?? [{ label: 'full' }]) as band (band.label)}
					<option value={band.label}>{band.label.toUpperCase()}</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 text-[#6a6a6a] uppercase tracking-widest">
			LOUDNESS
			<select bind:value={loudnessType} class="bg-[#1a1a1a] border border-[#3a3a3a] text-[#d4d0c8] px-2 py-1 uppercase">
				<option value="momentary">MOMENTARY</option>
				<option value="shortTerm">SHORT-TERM</option>
			</select>
		</label>
	</div>

	<!-- Plots -->
	<div class="flex-1 overflow-y-auto">
		{#if files.list.length === 0}
			<div class="flex items-center justify-center h-full text-[#3a3a3a] text-xs uppercase tracking-widest">
				NO FILES LOADED
			</div>
		{:else if results.data.length === 0}
			<div class="flex items-center justify-center h-full text-[#3a3a3a] text-xs uppercase tracking-widest">
				PRESS ANALYZE TO START
			</div>
		{:else}
			{#each files.list as audioFile (audioFile.id)}
				{@const result = results.data.find((r) => r.fileId === audioFile.id)}
				{#if result}
					<Plot {audioFile} {result} {selectedBand} {loudnessType} />
				{/if}
			{/each}
		{/if}
	</div>
</section>
