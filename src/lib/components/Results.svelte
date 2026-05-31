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
			lufs: (r.bands.find((b) => b.label === 'full') ?? r.bands[0])?.integrated ?? -Infinity
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
		</div>
	</div>
{/snippet}

{#snippet normalizeSelector()}
	{#if results.data.length > 1}
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
		</div>

		<!-- Plots area -->
		<div class="min-w-0 flex-1 overflow-y-auto">
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
				{#each files.list as audioFile (audioFile.id)}
					{@const result = results.data.find((r) => r.fileId === audioFile.id)}
					{#if result}
						<Plot
							{audioFile}
							{result}
							selectedBand={options.selectedBand}
							loudnessType={options.loudnessType}
							lufsOffset={lufsOffset(audioFile.id)}
						/>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
	<!-- end desktop flex row -->
</section>
