<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import { files } from '$lib/state/files.svelte';
	import { options } from '$lib/state/options.svelte';
	import { analysis } from '$lib/state/analysis.svelte';
	import { results, setResults, clearResults } from '$lib/state/results.svelte';
	import { analyzeFiles } from '$lib/audio/analysis';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let abortController: AbortController | null = null;

	const disabledReason = $derived(
		files.list.length === 0
			? 'No files loaded'
			: options.frequencies.length === 0
				? 'No crossovers defined'
				: results.isFresh
					? 'Already analyzed'
					: null
	);

	async function handleAnalyze() {
		const projectId = $page.params.id;
		abortController = new AbortController();
		analysis.isAnalyzing = true;
		analysis.progress = 0;
		clearResults();
		let success = false;
		try {
			const data = await analyzeFiles(
				files.list,
				options.frequencies,
				(p) => {
					analysis.progress = p;
				},
				abortController.signal
			);
			setResults(data);
			success = true;
		} catch (e) {
			if (!(e instanceof Error && e.name === 'AbortError')) throw e;
		} finally {
			analysis.isAnalyzing = false;
			analysis.progress = 0;
			abortController = null;
		}
		if (success) goto(`/projects/${projectId}/analysis`);
	}

	function handleCancel() {
		abortController?.abort();
	}
</script>

<div class="flex h-full min-h-0 flex-col">
	<!-- Upload + Options panels -->
	<div class="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
		<div
			class="min-h-48 overflow-y-auto border-b border-gray-700 md:min-h-0 md:w-2/3 md:border-r md:border-b-0"
		>
			<Upload />
		</div>
		<div class="overflow-y-auto md:flex-1">
			<Options />
		</div>
	</div>

	<!-- Full-width Analyze bar -->
	<div class="flex shrink-0 flex-col gap-2 border-t border-gray-700 p-3">
		{#if analysis.isAnalyzing}
			<div class="h-1 border border-gray-700 bg-gray-900">
				<div
					class="h-full bg-secondary-400 transition-all"
					style="width: {analysis.progress * 100}%"
				></div>
			</div>
		{/if}

		<div class="flex gap-2">
			<div class="flex flex-1 flex-col">
				{#if disabledReason && !analysis.isAnalyzing}
					<div class="mb-1 text-center text-xs text-gray-500">{disabledReason}</div>
				{/if}
				<button
					disabled={analysis.isAnalyzing || !!disabledReason}
					onclick={handleAnalyze}
					class="w-full cursor-pointer bg-secondary-400 py-2.5 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if analysis.isAnalyzing}
						MALMING<span class="dots"><span>.</span><span>.</span><span>.</span></span>
					{:else}
						Analyze
					{/if}
				</button>
			</div>

			{#if analysis.isAnalyzing}
				<button
					onclick={handleCancel}
					class="cursor-pointer border border-gray-700 px-4 py-2 text-xs tracking-widest text-danger-400 uppercase transition-colors hover:border-danger-400 hover:text-danger-300"
					>Cancel</button
				>
			{/if}
		</div>
	</div>
</div>

<style>
	.dots span {
		animation: blink 1s step-start infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
</style>
