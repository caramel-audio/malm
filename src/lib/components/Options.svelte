<script lang="ts">
	// Top-right panel: frequency band configuration + process / reset buttons
	// Shows a progress bar while analysis is running

	import { options } from '$lib/state/options.svelte';
	import { files } from '$lib/state/files.svelte';
	import { results } from '$lib/state/results.svelte';
	import { analyzeFiles } from '$lib/audio/analysis';

	// TODO: startAnalysis() — call analyzeFiles(), update options.isAnalyzing, write results
	// TODO: reset() — clear files.list, results.data, restore default frequencies
</script>

<section>
	<!-- Frequency list -->
	<ul>
		{#each options.frequencies as freq}
			<li>
				{freq} Hz
				<!-- TODO: editable input + remove button -->
			</li>
		{/each}
	</ul>
	<!-- TODO: add-frequency button -->

	<!-- Progress bar (visible while analyzing) -->
	{#if options.isAnalyzing}
		<progress></progress>
	{/if}

	<button disabled={options.isAnalyzing}>
		{options.isAnalyzing ? 'Analyzing…' : 'Analyze'}
	</button>
	<button>Reset</button>
</section>
