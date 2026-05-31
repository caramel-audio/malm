<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import { files } from '$lib/state/files.svelte';
	import { options } from '$lib/state/options.svelte';
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
		options.isAnalyzing = true;
		options.progress = 0;
		clearResults();
		let success = false;
		try {
			const data = await analyzeFiles(
				files.list,
				options.frequencies,
				(p) => { options.progress = p; },
				abortController.signal
			);
			setResults(data);
			success = true;
		} catch (e) {
			if (!(e instanceof Error && e.name === 'AbortError')) throw e;
		} finally {
			options.isAnalyzing = false;
			options.progress = 0;
			abortController = null;
		}
		if (success) goto(`/projects/${projectId}/analysis`);
	}

	function handleCancel() {
		abortController?.abort();
	}
</script>

<div class="flex flex-col h-full min-h-0">
	<!-- Upload + Options panels -->
	<div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
		<div class="md:w-2/3 border-b md:border-b-0 md:border-r border-gray-700 min-h-48 md:min-h-0 overflow-y-auto">
			<Upload />
		</div>
		<div class="md:flex-1 overflow-y-auto">
			<Options />
		</div>
	</div>

	<!-- Full-width Analyze bar -->
	<div class="shrink-0 border-t border-gray-700 p-3 flex flex-col gap-2">
		{#if options.isAnalyzing}
			<div class="h-1 bg-gray-900 border border-gray-700">
				<div class="h-full bg-secondary-400 transition-all" style="width: {options.progress * 100}%"></div>
			</div>
		{/if}

		<div class="flex gap-2">
			<div class="flex-1 flex flex-col">
				{#if disabledReason && !options.isAnalyzing}
					<div class="text-gray-500 text-xs text-center mb-1">{disabledReason}</div>
				{/if}
				<button
					disabled={options.isAnalyzing || !!disabledReason}
					onclick={handleAnalyze}
					class="w-full py-2.5 text-xs uppercase tracking-widest bg-secondary-400 text-gray-950 font-bold hover:bg-secondary-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
				>
					{options.isAnalyzing ? 'Analysing…' : 'Analyze'}
				</button>
			</div>

			{#if options.isAnalyzing}
				<button
					onclick={handleCancel}
					class="px-4 py-2 text-xs uppercase tracking-widest border border-gray-700 text-danger-400 hover:text-danger-300 hover:border-danger-400 cursor-pointer transition-colors"
				>Cancel</button>
			{/if}
		</div>
	</div>
</div>
