<script lang="ts">
	import { files, type AudioFile } from '$lib/state/files.svelte';
	import { results, spectrogramsFresh, type FileResult } from '$lib/state/results.svelte';
	import { options, SPECTROGRAM_ROW_HEIGHT_RANGE } from '$lib/state/options.svelte';
	import SpectrogramPlot from './SpectrogramPlot.svelte';
	import BusyOverlay from './BusyOverlay.svelte';
	import RowHeightSlider from './RowHeightSlider.svelte';
	import SidebarAnalyze from './SidebarAnalyze.svelte';

	const fresh = $derived(spectrogramsFresh(files.list.map((f) => f.id)));

	// Same guard as the loudness tab: switching the axis redraws every canvas
	// synchronously, so let the overlay paint before handing over the new setting.
	let busy = $state(false);
	let appliedLogFreq = $state(options.spectrogramLogFreq);

	$effect(() => {
		const next = options.spectrogramLogFreq;
		if (next === appliedLogFreq) return;
		busy = true;
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				appliedLogFreq = next;
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
</script>

{#snippet plot(audioFile: AudioFile, result: FileResult)}
	<SpectrogramPlot
		{audioFile}
		{result}
		logFreq={appliedLogFreq}
		height={options.spectrogramRowHeight}
	/>
{/snippet}

{#snippet axisSelector()}
	<div>
		<div class="mb-1.5 text-xs tracking-widest text-gray-500 uppercase">Frequency</div>
		<div class="flex flex-col border border-gray-700">
			<button
				onclick={() => (options.spectrogramLogFreq = false)}
				class="px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
					{!options.spectrogramLogFreq
					? 'bg-gray-800 text-gray-100'
					: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Linear</button
			>
			<button
				onclick={() => (options.spectrogramLogFreq = true)}
				class="border-t border-gray-700 px-3 py-1.5 text-left text-xs tracking-widest whitespace-nowrap uppercase transition-colors
					{options.spectrogramLogFreq
					? 'bg-gray-800 text-gray-100'
					: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}">Log</button
			>
		</div>
	</div>
{/snippet}

{#snippet rowHeightSlider()}
	<RowHeightSlider
		bind:value={options.spectrogramRowHeight}
		min={SPECTROGRAM_ROW_HEIGHT_RANGE.min}
		max={SPECTROGRAM_ROW_HEIGHT_RANGE.max}
	/>
{/snippet}

<section class="flex h-full min-h-0 flex-col">
	<!-- Controls: two-column top bar on mobile, left sidebar on sm+ -->
	<div class="flex shrink-0 gap-3 border-b border-gray-700 p-3 sm:hidden">
		<div class="min-w-0 flex-1">{@render axisSelector()}</div>
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			{@render rowHeightSlider()}
			<SidebarAnalyze {fresh} reason="No spectrogram" />
		</div>
	</div>

	<div class="flex min-h-0 flex-1">
		<!-- Left sidebar: hidden on mobile -->
		<div
			class="hidden shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-700 p-3 sm:flex"
		>
			{@render axisSelector()}
			<div class="w-[140px]">{@render rowHeightSlider()}</div>
			<SidebarAnalyze {fresh} reason="No spectrogram" />
		</div>

		<!-- Plots area: the pinned track sits above the scroll box so it stays put -->
		<div class="relative flex min-w-0 flex-1 flex-col">
			{#if busy}
				<BusyOverlay label="Redrawing" />
			{/if}
			{#if pinnedPlot}
				<div class="shrink-0 border-b-2 border-gray-700" data-testid="pinned-spectrogram">
					{@render plot(pinnedPlot.audioFile, pinnedPlot.result)}
				</div>
			{/if}
			<div class="min-h-0 flex-1 overflow-y-auto" data-testid="spectrogram-scroll">
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
</section>
