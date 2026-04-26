<script lang="ts">
	import { options, addFrequency, removeFrequency, resetOptions } from '$lib/state/options.svelte';
	import { files } from '$lib/state/files.svelte';
	import { analyzeFiles } from '$lib/audio/analysis';
	import { setResults, clearResults } from '$lib/state/results.svelte';

	let newFreq = $state('');
	let inputError = $state('');
	let abortController: AbortController | null = null;

	const disabledReason = $derived(
		files.list.length === 0
			? 'No files loaded'
			: options.frequencies.length === 0
				? 'No crossovers defined'
				: null
	);

	function fmtHz(hz: number): string {
		return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
	}

	function bandLabels(freqs: number[]): string[] {
		if (freqs.length === 0) return ['Full'];
		const s = [...freqs].sort((a, b) => a - b);
		const out: string[] = [`0–${fmtHz(s[0])} Hz`];
		for (let i = 0; i < s.length - 1; i++) {
			out.push(`${fmtHz(s[i])}–${fmtHz(s[i + 1])} Hz`);
		}
		out.push(`${fmtHz(s[s.length - 1])}+ Hz`);
		return out;
	}

	function handleAdd() {
		const hz = Number(newFreq);
		if (!Number.isFinite(hz) || hz <= 0 || !Number.isInteger(hz)) {
			inputError = 'Enter a positive integer';
			return;
		}
		if (options.frequencies.includes(hz)) {
			inputError = 'Already exists';
			return;
		}
		addFrequency(hz);
		newFreq = '';
		inputError = '';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAdd();
		else inputError = '';
	}

	async function handleAnalyze() {
		abortController = new AbortController();
		options.isAnalyzing = true;
		options.progress = 0;
		clearResults();
		try {
			const data = await analyzeFiles(files.list, options.frequencies, (p) => {
				options.progress = p;
			}, abortController.signal);
			setResults(data);
		} catch (e) {
			if (!(e instanceof Error && e.name === 'AbortError')) throw e;
		} finally {
			options.isAnalyzing = false;
			options.progress = 0;
			abortController = null;
		}
	}

	function handleCancel() {
		abortController?.abort();
	}
</script>

<section class="h-full flex flex-col">
	<div class="px-3 py-2 border-b border-[#3a3a3a] text-[#c8a84b] uppercase tracking-widest text-xs">
		OPTIONS
	</div>

	<div class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
		<!-- Crossovers + Add (horizontal) -->
		<div class="flex gap-16">
			<!-- Crossover list -->
			<div class="w-1/2 min-w-0">
				<div class="text-[#6a6a6a] text-xs uppercase tracking-widest mb-2">Crossovers</div>
				{#if options.frequencies.length === 0}
					<div class="text-[#3a3a3a] text-xs italic">None</div>
				{:else}
					<ul class="flex flex-col gap-0.5">
						{#each options.frequencies as hz (hz)}
							<li class="flex items-center gap-2 group">
								<span class="tabular-nums text-xs text-[#d4d0c8] w-14 text-right">{hz}</span>
								<span class="text-[#6a6a6a] text-xs">Hz</span>
								<button
									class="ml-auto text-[#3a3a3a] group-hover:text-[#6a6a6a] hover:!text-[#c8a84b] text-xs"
									onclick={() => removeFrequency(hz)}
									aria-label="Remove {hz} Hz"
								>✕</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- Add crossover -->
			<div class="w-1/2">
				<div class="text-[#6a6a6a] text-xs uppercase tracking-widest mb-2">Add</div>
				<div class="flex gap-2 items-center">
					<input
						type="number"
						min="1"
						step="1"
						bind:value={newFreq}
						onkeydown={onKeydown}
						placeholder="Hz"
						class="w-20 bg-[#1a1a1a] border border-[#3a3a3a] text-[#d4d0c8] text-xs px-2 py-1 focus:outline-none focus:border-[#c8a84b] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					/>
					<button
						onclick={handleAdd}
						class="px-3 py-1 text-xs uppercase tracking-widest border border-[#3a3a3a] text-[#6a6a6a] hover:border-[#c8a84b] hover:text-[#c8a84b]"
					>+</button>
				</div>
				{#if inputError}
					<div class="text-[#c84b4b] text-xs mt-1">{inputError}</div>
				{/if}
			</div>
		</div>

		<!-- Resulting bands -->
		<div>
			<div class="text-[#6a6a6a] text-xs uppercase tracking-widest mb-2">Resulting Bands</div>
			<div class="flex flex-wrap gap-1">
				{#each bandLabels(options.frequencies) as label (label)}
					<span class="text-xs border border-[#3a3a3a] text-[#6a6a6a] px-1.5 py-0.5">{label}</span>
				{/each}
			</div>
		</div>
	</div>

	<!-- Progress bar -->
	{#if options.isAnalyzing}
		<div class="mx-3 mb-2 h-1 bg-[#1a1a1a] border border-[#3a3a3a]">
			<div class="h-full bg-[#c8a84b] transition-all" style="width: {options.progress * 100}%"></div>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="flex border-t border-[#3a3a3a]">
		<div class="flex-1 flex flex-col">
			{#if disabledReason && !options.isAnalyzing}
				<div class="text-[#6a6a6a] text-xs text-center py-0.5">{disabledReason}</div>
			{/if}
			<button
				disabled={options.isAnalyzing || !!disabledReason}
				onclick={handleAnalyze}
				class="flex-1 py-2 text-xs uppercase tracking-widest bg-[#c8a84b] text-[#0e0e0e] font-bold hover:bg-[#d4b85a] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				{options.isAnalyzing ? 'ANALYZING…' : 'ANALYZE'}
			</button>
		</div>
		{#if options.isAnalyzing}
			<button
				onclick={handleCancel}
				class="px-4 py-2 text-xs uppercase tracking-widest border-l border-[#3a3a3a] text-[#c84b4b] hover:text-[#d47070] cursor-pointer"
			>
				CANCEL
			</button>
		{:else}
			<button
				onclick={resetOptions}
				class="px-4 py-2 text-xs uppercase tracking-widest border-l border-[#3a3a3a] text-[#6a6a6a] hover:text-[#d4d0c8]"
			>
				RESET
			</button>
		{/if}
	</div>
</section>
