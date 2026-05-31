<script lang="ts">
	import { files } from '$lib/state/files.svelte';
	import { results } from '$lib/state/results.svelte';
	import { options } from '$lib/state/options.svelte';
	import Plot from './Plot.svelte';

	const bands = $derived(results.data[0]?.bands ?? [{ label: 'full' }]);

	// If the persisted band no longer exists in results, fall back to 'full'.
	$effect(() => {
		if (bands.length > 0 && !bands.some((b) => b.label === options.selectedBand)) {
			options.selectedBand = 'full';
		}
	});

	const fileIntegratedLufs = $derived(
		results.data.map((r) => ({
			fileId: r.fileId,
			lufs: (r.bands.find((b) => b.label === 'full') ?? r.bands[0])?.integrated ?? -Infinity,
		}))
	);

	const quietestEntry = $derived(
		fileIntegratedLufs.reduce<{ fileId: string; lufs: number } | null>(
			(min, e) => (min === null || e.lufs < min.lufs ? e : min),
			null
		)
	);

	const quietestFile = $derived(
		quietestEntry ? files.list.find((f) => f.id === quietestEntry.fileId) : null
	);

	function lufsOffset(fileId: string): number {
		if (!options.normalizeToQuietest || !quietestEntry) return 0;
		const entry = fileIntegratedLufs.find((e) => e.fileId === fileId);
		if (!entry || !isFinite(entry.lufs) || !isFinite(quietestEntry.lufs)) return 0;
		return quietestEntry.lufs - entry.lufs;
	}

	function bandLabel(label: string): string {
		return label === 'full' ? 'Full' : label;
	}
</script>

<section class="flex flex-col h-full min-h-0">
	<!-- Controls: two-column top bar on mobile, left sidebar on sm+ -->
	<div class="shrink-0 sm:hidden border-b border-gray-700 p-3 flex gap-3">

		<!-- Left column: Band selector -->
		<div class="flex-1 min-w-0">
			<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Band</div>
			<div class="border border-gray-700 flex flex-col">
				{#each bands as band, i (band.label)}
					<button
						onclick={() => options.selectedBand = band.label}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
							{i > 0 ? 'border-t border-gray-700' : ''}
							{options.selectedBand === band.label
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>{bandLabel(band.label)}</button>
				{/each}
			</div>
		</div>

		<!-- Right column: Loudness + Normalize -->
		<div class="flex-1 min-w-0 flex flex-col gap-3">
			<div>
				<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Loudness</div>
				<div class="border border-gray-700 flex flex-col">
					<button
						onclick={() => options.loudnessType = 'momentary'}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
							{options.loudnessType === 'momentary'
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>Momentary</button>
					<button
						onclick={() => options.loudnessType = 'shortTerm'}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors border-t border-gray-700 whitespace-nowrap
							{options.loudnessType === 'shortTerm'
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>Short-term</button>
				</div>
			</div>

			{#if results.data.length > 1}
				<div>
					<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Normalize</div>
					<div class="border border-gray-700 flex flex-col">
						<button
							onclick={() => options.normalizeToQuietest = false}
							class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
								{!options.normalizeToQuietest
									? 'bg-gray-800 text-gray-100'
									: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
						>Off</button>
						<button
							onclick={() => options.normalizeToQuietest = true}
							class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors border-t border-gray-700 whitespace-nowrap
								{options.normalizeToQuietest
									? 'bg-gray-800 text-gray-100'
									: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
						>To quietest</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Desktop layout: sidebar + plots side by side -->
	<div class="flex flex-1 min-h-0">
	<!-- Left sidebar: hidden on mobile -->
	<div class="hidden sm:flex shrink-0 border-r border-gray-700 p-3 flex-col gap-4 overflow-y-auto">

		<!-- Band selector -->
		<div>
			<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Band</div>
			<div class="border border-gray-700 flex flex-col">
				{#each bands as band, i (band.label)}
					<button
						onclick={() => options.selectedBand = band.label}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
							{i > 0 ? 'border-t border-gray-700' : ''}
							{options.selectedBand === band.label
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>{bandLabel(band.label)}</button>
				{/each}
			</div>
		</div>

		<!-- Loudness type selector -->
		<div>
			<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Loudness</div>
			<div class="border border-gray-700 flex flex-col">
				<button
					onclick={() => options.loudnessType = 'momentary'}
					class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
						{options.loudnessType === 'momentary'
							? 'bg-gray-800 text-gray-100'
							: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
				>Momentary</button>
				<button
					onclick={() => options.loudnessType = 'shortTerm'}
					class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors border-t border-gray-700 whitespace-nowrap
						{options.loudnessType === 'shortTerm'
							? 'bg-gray-800 text-gray-100'
							: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
				>Short-term</button>
			</div>
		</div>

		<!-- Normalize (only with multiple files) -->
		{#if results.data.length > 1}
			<div>
				<div class="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Normalize</div>
				<div class="border border-gray-700 flex flex-col">
					<button
						onclick={() => options.normalizeToQuietest = false}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors whitespace-nowrap
							{!options.normalizeToQuietest
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>Off</button>
					<button
						onclick={() => options.normalizeToQuietest = true}
						class="px-3 py-1.5 text-xs uppercase tracking-widest text-left transition-colors border-t border-gray-700 whitespace-nowrap
							{options.normalizeToQuietest
								? 'bg-gray-800 text-gray-100'
								: 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}"
					>To quietest</button>
				</div>
				{#if options.normalizeToQuietest && quietestFile}
					<div class="text-gray-500 text-xs mt-1.5 max-w-[120px] leading-tight">
						{quietestFile.name}{quietestFile.artist ? ` — ${quietestFile.artist}` : ''}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Plots area -->
	<div class="flex-1 overflow-y-auto min-w-0">
		{#if files.list.length === 0}
			<div class="flex items-center justify-center h-full text-gray-500 text-xs uppercase tracking-widest">
				No files loaded
			</div>
		{:else if results.data.length === 0}
			<div class="flex items-center justify-center h-full text-gray-500 text-xs uppercase tracking-widest">
				Press Analyze to start
			</div>
		{:else}
			{#each files.list as audioFile (audioFile.id)}
				{@const result = results.data.find((r) => r.fileId === audioFile.id)}
				{#if result}
					<Plot {audioFile} {result} selectedBand={options.selectedBand} loudnessType={options.loudnessType} lufsOffset={lufsOffset(audioFile.id)} />
				{/if}
			{/each}
		{/if}
	</div>
	</div><!-- end desktop flex row -->
</section>
