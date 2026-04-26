<script lang="ts">
	// Bottom panel: band selector, loudness type selector, one Plot per file

	import { files } from '$lib/state/files.svelte';
	import { results } from '$lib/state/results.svelte';
	import Plot from './Plot.svelte';

	// TODO: derive band label list from results (or options.frequencies)
	let selectedBand = $state('full');
	let loudnessType = $state<'momentary' | 'shortTerm'>('momentary');
</script>

<section>
	<div class="controls">
		<label>
			Band
			<select bind:value={selectedBand}>
				<option value="full">Full spectrum</option>
				<!-- TODO: render one option per band -->
			</select>
		</label>

		<label>
			Loudness
			<select bind:value={loudnessType}>
				<option value="momentary">Momentary</option>
				<option value="shortTerm">Short-term</option>
			</select>
		</label>
	</div>

	{#each files.list as audioFile (audioFile.id)}
		{@const result = results.data.find((r) => r.fileId === audioFile.id)}
		{#if result}
			<Plot {audioFile} {result} {selectedBand} {loudnessType} />
		{/if}
	{/each}
</section>
