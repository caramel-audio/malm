<script lang="ts">
	// Re-analyze control for the result tabs. Same single pass as the Analyze bar
	// in setup — this is a shortcut, not a second pipeline.
	import { files } from '$lib/state/files.svelte';
	import { analysis, runAnalysis, cancelAnalysis } from '$lib/state/analysis.svelte';

	type Props = {
		/** Whether this tab's data matches the current files and options. */
		fresh: boolean;
		/** Why it does not, e.g. "Options changed". */
		reason?: string;
	};

	let { fresh, reason = 'Out of date' }: Props = $props();

	const nothingToDo = $derived(files.list.length === 0);
</script>

{#if analysis.isAnalyzing}
	<div>
		<div class="mb-1.5 text-xs tracking-widest text-gray-500 uppercase">Analyzing</div>
		<div class="h-1 border border-gray-700 bg-gray-900">
			<div
				class="h-full bg-secondary-400 transition-all"
				style="width: {analysis.progress * 100}%"
			></div>
		</div>
		<button
			onclick={cancelAnalysis}
			class="mt-2 w-full cursor-pointer border border-gray-700 px-3 py-1.5 text-xs tracking-widest text-danger-400 uppercase transition-colors hover:border-danger-400 hover:text-danger-300"
			>Cancel</button
		>
	</div>
{:else if !fresh && !nothingToDo}
	<div data-testid="stale-notice">
		<div class="mb-1.5 text-xs tracking-widest text-secondary-400 uppercase">{reason}</div>
		<button
			onclick={() => runAnalysis()}
			class="w-full cursor-pointer bg-secondary-400 px-3 py-1.5 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300"
			>Re-analyze</button
		>
	</div>
{/if}
