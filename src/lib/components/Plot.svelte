<script lang="ts">
	// One waveform + loudness plot for a single audio file
	// D3 draws the waveform and loudness curve; WaveSurfer handles playback
	// Click on plot → seek & play (filtered band if one is selected)
	// Hover → show time, peak dBFS, momentary LUFS, short-term LUFS below plot

	import type { AudioFile } from '$lib/state/files.svelte';
	import type { FileResult } from '$lib/state/results.svelte';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		selectedBand: string; // band label or "full"
		loudnessType: 'momentary' | 'shortTerm';
	};

	let { audioFile, result, selectedBand, loudnessType }: Props = $props();

	// TODO: init WaveSurfer on mount, destroy on unmount
	// TODO: draw D3 loudness overlay when result/selectedBand/loudnessType changes
	// TODO: handle click → seek WaveSurfer to clicked time, play correct band buffer
	// TODO: handle mousemove → update hover info (time, peak, momentary, short-term)

	let hoverInfo = $state<{ time: string; peak: number; momentary: number; shortTerm: number } | null>(null);
</script>

<div class="plot-container">
	<!-- WaveSurfer mount point -->
	<div class="waveform"></div>

	<!-- D3 SVG overlay for loudness curve -->
	<svg class="loudness-overlay"></svg>

	<!-- Hover info bar -->
	{#if hoverInfo}
		<div class="hover-info">
			<span>{hoverInfo.time}</span>
			<span>{hoverInfo.peak.toFixed(1)} dBFS</span>
			<span>{hoverInfo.momentary.toFixed(1)} LUFS (M)</span>
			<span>{hoverInfo.shortTerm.toFixed(1)} LUFS (S)</span>
		</div>
	{/if}
</div>
