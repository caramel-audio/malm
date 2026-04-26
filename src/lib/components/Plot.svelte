<script lang="ts">
	import type { AudioFile } from '$lib/state/files.svelte';
	import type { FileResult } from '$lib/state/results.svelte';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		selectedBand: string;
		loudnessType: 'momentary' | 'shortTerm';
	};

	let { audioFile, result, selectedBand, loudnessType }: Props = $props();

	function lastValue(pairs: [number, number][]): number | null {
		return pairs.length > 0 ? pairs[pairs.length - 1][1] : null;
	}

	function minValue(pairs: [number, number][]): number | null {
		if (pairs.length === 0) return null;
		return Math.min(...pairs.map(([, v]) => v));
	}

	function maxValue(pairs: [number, number][]): number | null {
		if (pairs.length === 0) return null;
		return Math.max(...pairs.map(([, v]) => v));
	}

	function fmt(v: number | null, decimals = 1): string {
		return v !== null ? v.toFixed(decimals) : '—';
	}

	function fmtDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}
</script>

<div class="border-b border-[#3a3a3a] px-3 py-3">
	<!-- File header -->
	<div class="flex items-baseline gap-3 mb-3">
		<span class="text-[#c8a84b] text-xs uppercase tracking-widest font-bold">
			{audioFile.artist ? `${audioFile.artist} — ` : ''}{audioFile.name}
		</span>
		<span class="text-[#3a3a3a] text-xs">{fmtDuration(audioFile.duration)}</span>
	</div>

	<!-- LUFS table -->
	<table class="w-full text-xs border-collapse">
		<thead>
			<tr class="text-[#6a6a6a] uppercase tracking-widest">
				<th class="text-left py-1 pr-4 font-normal border-b border-[#3a3a3a]">Band</th>
				<th class="text-right py-1 px-4 font-normal border-b border-[#3a3a3a]">Max LUFS</th>
				<th class="text-right py-1 px-4 font-normal border-b border-[#3a3a3a]">Min LUFS</th>
				<th class="text-right py-1 pl-4 font-normal border-b border-[#3a3a3a]">Peak dBFS</th>
			</tr>
		</thead>
		<tbody>
			{#each result.bands as band (band.label)}
				{@const series = loudnessType === 'momentary' ? band.momentary : band.shortTerm}
				{@const isSelected = band.label === selectedBand}
				<tr class={isSelected ? 'text-[#d4d0c8]' : 'text-[#4a4a4a]'}>
					<td class="py-1 pr-4">{band.label}</td>
					<td class="text-right py-1 px-4 tabular-nums">{fmt(maxValue(series))}</td>
					<td class="text-right py-1 px-4 tabular-nums">{fmt(minValue(series))}</td>
					<td class="text-right py-1 pl-4 tabular-nums">{fmt(maxValue(band.peak))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
