<script lang="ts">
	import { files, type AudioFile } from '$lib/state/files.svelte';
	import { results, lufsOffset, quietestFileId, type FileResult } from '$lib/state/results.svelte';
	import { options, ROW_HEIGHT_RANGE } from '$lib/state/options.svelte';
	import Plot from './Plot.svelte';
	import BusyOverlay from './BusyOverlay.svelte';
	import RowHeightSlider from './RowHeightSlider.svelte';
	import SidebarAnalyze from './SidebarAnalyze.svelte';

	const bands = $derived(results.data[0]?.bands ?? [{ label: 'full' }]);

	// If the persisted band no longer exists in results, fall back to 'full'.
	$effect(() => {
		if (bands.length > 0 && !bands.some((b) => b.label === options.selectedBand)) {
			options.selectedBand = 'full';
		}
	});

	const STEREO_VIEWS = new Set(['balance', 'correlation']);

	// Mono-only projects (and results from before the stereo views existed) have
	// nothing to compare, so the buttons stay out of the way.
	const hasStereo = $derived(results.data.some((r) => r.bands.some((b) => b.balance?.length)));
	const hasCorrelation = $derived(
		results.data.some((r) => r.bands.some((b) => b.correlation?.length))
	);

	$effect(() => {
		if (results.data.length === 0) return;
		if (!hasStereo && options.loudnessType === 'balance') options.loudnessType = 'momentary';
		if (!hasCorrelation && options.loudnessType === 'correlation') {
			options.loudnessType = 'momentary';
		}
	});

	const quietestFile = $derived(files.list.find((f) => f.id === quietestFileId()) ?? null);

	// Redrawing every plot is synchronous and takes seconds with many tracks, so
	// the new settings are only handed to the plots once the browser has painted
	// the overlay — otherwise the page just freezes with no explanation.
	let busy = $state(false);
	let applied = $state({
		band: options.selectedBand,
		loudnessType: options.loudnessType,
		normalize: options.normalizeToQuietest
	});

	$effect(() => {
		const next = {
			band: options.selectedBand,
			loudnessType: options.loudnessType,
			normalize: options.normalizeToQuietest
		};
		if (
			next.band === applied.band &&
			next.loudnessType === applied.loudnessType &&
			next.normalize === applied.normalize
		) {
			return;
		}
		busy = true;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				applied = next;
				busy = false;
			})
		);
	});

	const pinnedPlot = $derived.by(() => {
		const audioFile = files.list.find((f) => f.id === options.pinnedFileId);
		const result = audioFile && results.data.find((r) => r.fileId === audioFile.id);
		return audioFile && result ? { audioFile, result } : null;
	});

	const unpinned = $derived(files.list.filter((f) => f.id !== pinnedPlot?.audioFile.id));

	function bandLabel(label: string): string {
		return label === 'full' ? 'Full' : label;
	}
</script>

{#snippet plot(audioFile: AudioFile, result: FileResult)}
	<Plot
		{audioFile}
		{result}
		selectedBand={applied.band}
		loudnessType={applied.loudnessType}
		lufsOffset={applied.normalize ? lufsOffset(audioFile.id) : 0}
		height={options.rowHeight}
	/>
{/snippet}

{#snippet rowHeightSlider()}
	<RowHeightSlider
		bind:value={options.rowHeight}
		min={ROW_HEIGHT_RANGE.min}
		max={ROW_HEIGHT_RANGE.max}
	/>
{/snippet}

{#snippet bandSelector()}
	<div>
		<div class="mb-1.5 text-xs tracking-widest text-gray-500 uppercase">Band</div>
		<div class="flex flex-col border border-gray-700">
			{#each bands as band, i (band.label)}
				<button
					onclick={() => (options.selectedBand = band.label)}
					class="px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
						{i > 0 ? 'border-t border-gray-700' : ''}
						{options.selectedBand === band.label
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
					>{bandLabel(band.label)}</button
				>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet loudnessSelector()}
	<div>
		<div class="mb-1.5 text-xs tracking-widest text-gray-500 uppercase">Loudness</div>
		<div class="flex flex-col border border-gray-700">
			<button
				onclick={() => (options.loudnessType = 'momentary')}
				class="px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
					{options.loudnessType === 'momentary'
					? 'bg-gray-800 text-gray-100'
					: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Momentary</button
			>
			<button
				onclick={() => (options.loudnessType = 'shortTerm')}
				class="border-t border-gray-700 px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
					{options.loudnessType === 'shortTerm'
					? 'bg-gray-800 text-gray-100'
					: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Short-term</button
			>
			{#if hasStereo}
				<button
					onclick={() => (options.loudnessType = 'balance')}
					class="border-t border-gray-700 px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
						{options.loudnessType === 'balance'
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">L/R balance</button
				>
			{/if}
			{#if hasCorrelation}
				<button
					onclick={() => (options.loudnessType = 'correlation')}
					class="border-t border-gray-700 px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
						{options.loudnessType === 'correlation'
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Correlation</button
				>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet normalizeSelector()}
	<!-- Both stereo views compare two channels of the same file; a per-file gain
	     offset cancels out of them, so the control would do nothing. -->
	{#if results.data.length > 1 && !STEREO_VIEWS.has(options.loudnessType)}
		<div>
			<div class="mb-1.5 text-xs tracking-widest text-gray-500 uppercase">Normalize</div>
			<div class="flex flex-col border border-gray-700">
				<button
					onclick={() => (options.normalizeToQuietest = false)}
					class="px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
						{!options.normalizeToQuietest
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Off</button
				>
				<button
					onclick={() => (options.normalizeToQuietest = true)}
					class="border-t border-gray-700 px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
						{options.normalizeToQuietest
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">To quietest</button
				>
			</div>
		</div>
	{/if}
{/snippet}

<section class="flex h-full min-h-0 flex-col">
	<!-- Controls: two-column top bar on mobile, left sidebar on sm+ -->
	<div class="flex shrink-0 gap-3 border-b border-gray-700 p-3 sm:hidden">
		<div class="min-w-0 flex-1">{@render bandSelector()}</div>
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			{@render loudnessSelector()}
			{@render normalizeSelector()}
			{@render rowHeightSlider()}
			<SidebarAnalyze fresh={results.isFresh} />
		</div>
	</div>

	<!-- Desktop layout: sidebar + plots side by side -->
	<div class="flex min-h-0 flex-1">
		<!-- Left sidebar: hidden on mobile -->
		<div
			class="hidden shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-700 p-3 sm:flex"
		>
			{@render bandSelector()}
			{@render loudnessSelector()}
			{@render normalizeSelector()}
			{#if options.normalizeToQuietest && quietestFile && results.data.length > 1}
				<div class="mt-1.5 max-w-[120px] text-xs leading-tight text-gray-500">
					{quietestFile.name}{quietestFile.artist ? ` — ${quietestFile.artist}` : ''}
				</div>
			{/if}
			<div class="w-[140px]">{@render rowHeightSlider()}</div>
			<SidebarAnalyze fresh={results.isFresh} />
		</div>

		<!-- Plots area: the pinned track sits above the scroll box so it stays put -->
		<div class="relative flex min-w-0 flex-1 flex-col">
			{#if busy}
				<BusyOverlay label="Redrawing" />
			{/if}
			{#if pinnedPlot}
				<div class="shrink-0 border-b-2 border-gray-700" data-testid="pinned-plot">
					{@render plot(pinnedPlot.audioFile, pinnedPlot.result)}
				</div>
			{/if}
			<div class="min-h-0 flex-1 overflow-y-auto" data-testid="plot-scroll">
				{#if files.list.length === 0}
					<div
						class="flex h-full items-center justify-center text-xs tracking-widest text-gray-500 uppercase"
					>
						No files loaded
					</div>
				{:else if results.data.length === 0}
					<div
						class="flex h-full items-center justify-center text-xs tracking-widest text-gray-500 uppercase"
					>
						Press Analyze to start
					</div>
				{:else}
					{#each unpinned as audioFile (audioFile.id)}
						{@const result = results.data.find((r) => r.fileId === audioFile.id)}
						{#if result}
							{@render plot(audioFile, result)}
						{/if}
					{/each}
				{/if}
			</div>
		</div>
	</div>
	<!-- end desktop flex row -->
</section>
