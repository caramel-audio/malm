<script lang="ts">
	// Bottom panel: band selector, loudness type selector, one Plot per file
	import { files } from '$lib/state/files.svelte';
	import { results } from '$lib/state/results.svelte';
	import Plot from './Plot.svelte';

	let selectedBand = $state('full');
	let loudnessType = $state<'momentary' | 'shortTerm'>('momentary');
	let normalizeToQuietest = $state(false);

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
		if (!normalizeToQuietest || !quietestEntry) return 0;
		const entry = fileIntegratedLufs.find((e) => e.fileId === fileId);
		if (!entry || !isFinite(entry.lufs) || !isFinite(quietestEntry.lufs)) return 0;
		return quietestEntry.lufs - entry.lufs;
	}
</script>

<section class="flex flex-col h-full">
	<!-- Controls bar -->
	<div class="flex items-center gap-4 px-3 py-2 border-b border-[#3a3a3a] text-xs">
		<label class="flex items-center gap-2 text-[#6a6a6a] uppercase tracking-widest">
			BAND
			<select bind:value={selectedBand} class="bg-[#1a1a1a] border border-[#3a3a3a] text-[#d4d0c8] px-2 py-1 uppercase">
				{#each (results.data[0]?.bands ?? [{ label: 'full' }]) as band (band.label)}
					<option value={band.label}>{band.label.toUpperCase()}</option>
				{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 text-[#6a6a6a] uppercase tracking-widest">
			LOUDNESS
			<select bind:value={loudnessType} class="bg-[#1a1a1a] border border-[#3a3a3a] text-[#d4d0c8] px-2 py-1 uppercase">
				<option value="momentary">MOMENTARY</option>
				<option value="shortTerm">SHORT-TERM</option>
			</select>
		</label>
		{#if results.data.length > 1}
			<label class="flex items-center gap-2 text-[#6a6a6a] uppercase tracking-widest cursor-pointer select-none">
				<input type="checkbox" bind:checked={normalizeToQuietest} class="accent-[#c8a84b]" />
				NORMALIZE TO QUIETEST
			</label>
			{#if normalizeToQuietest && quietestFile}
				<span class="text-[#6a6a6a] uppercase tracking-widest font-bold">
					({quietestFile.artist ? `${quietestFile.artist} — ` : ''}{quietestFile.name})
				</span>
			{/if}
		{/if}
	</div>

	<!-- Plots -->
	<div class="flex-1 overflow-y-auto">
		{#if files.list.length === 0}
			<div class="flex items-center justify-center h-full text-[#3a3a3a] text-xs uppercase tracking-widest">
				NO FILES LOADED
			</div>
		{:else if results.data.length === 0}
			<div class="flex items-center justify-center h-full text-[#3a3a3a] text-xs uppercase tracking-widest">
				PRESS ANALYZE TO START
			</div>
		{:else}
			{#each files.list as audioFile (audioFile.id)}
				{@const result = results.data.find((r) => r.fileId === audioFile.id)}
				{#if result}
					<Plot {audioFile} {result} {selectedBand} {loudnessType} lufsOffset={lufsOffset(audioFile.id)} />
				{/if}
			{/each}
		{/if}
	</div>
</section>
