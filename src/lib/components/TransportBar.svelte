<script lang="ts">
	import { playback, setGain } from '$lib/audio/playback.svelte';
	import {
		transport,
		currentFile,
		gainDbFor,
		readout,
		reapplyBand,
		restart,
		seekBy,
		toggle
	} from '$lib/audio/transport.svelte';
	import { options } from '$lib/state/options.svelte';
	import { formatTime, lufsColor } from '$lib/format';

	const file = $derived(currentFile());
	const values = $derived(readout());
	const elapsed = $derived(values.time ?? playback.currentTime);

	// Gain follows the band/normalization choice while a track is playing.
	$effect(() => {
		const id = playback.currentFileId;
		if (!id) return;
		setGain(gainDbFor(id));
	});

	// A band or slope change rebuilds the filter chain under the playhead.
	$effect(() => {
		void options.selectedBand;
		void options.slope;
		reapplyBand();
	});

	function lufsText(v: number | null): string {
		return v === null || !isFinite(v) ? '—' : v.toFixed(1);
	}

	function lufsStyle(v: number | null): string {
		return values.hovering && v !== null && isFinite(v) ? `color: ${lufsColor(v)}` : '';
	}
</script>

<section
	aria-label="Transport"
	class="flex shrink-0 items-center gap-3 border-t border-gray-700 bg-gray-950 px-3 py-2"
>
	<!-- Current track -->
	<div class="min-w-0 flex-1">
		{#if file}
			<div class="truncate text-xs text-gray-100">{file.name}</div>
			<div class="mt-0.5 truncate font-mono text-[10px] text-gray-500" data-testid="transport-time">
				{formatTime(elapsed)} / {formatTime(file.duration)}
			</div>
		{:else}
			<div class="text-xs tracking-widest text-gray-600 uppercase">No track</div>
			<div class="mt-0.5 font-mono text-[10px] text-gray-700" data-testid="transport-time">
				0:00 / 0:00
			</div>
		{/if}
	</div>

	<!-- Transport controls -->
	<div class="flex shrink-0 items-center gap-1">
		<button
			class="cursor-pointer p-1.5 text-gray-400 transition-colors hover:text-white"
			onclick={restart}
			aria-label="Back to start"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
				<path d="M6 5h2v14H6zM20 5.5v13L10 12z" />
			</svg>
		</button>
		<button
			class="cursor-pointer p-1.5 text-gray-400 transition-colors hover:text-white"
			onclick={() => seekBy(-10)}
			aria-label="Back 10 seconds"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
				<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
			</svg>
		</button>
		<button
			class="cursor-pointer rounded-full bg-gray-800 p-2 text-gray-100 transition-colors hover:bg-gray-700"
			onclick={toggle}
			aria-label={playback.isPlaying ? 'Pause' : 'Play'}
		>
			{#if playback.isPlaying}
				<svg viewBox="0 0 24 24" fill="currentColor" class="size-5" aria-hidden="true">
					<path d="M7 5h4v14H7zM13 5h4v14h-4z" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="currentColor" class="size-5" aria-hidden="true">
					<path d="M7 4.5v15l13-7.5z" />
				</svg>
			{/if}
		</button>
		<button
			class="cursor-pointer p-1.5 text-gray-400 transition-colors hover:text-white"
			onclick={() => seekBy(10)}
			aria-label="Forward 10 seconds"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
				<path d="M12 5V2l5 4-5 4V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z" />
			</svg>
		</button>
		<button
			class="cursor-pointer p-1.5 transition-colors {transport.repeat
				? 'text-secondary-400'
				: 'text-gray-400 hover:text-white'}"
			onclick={() => (transport.repeat = !transport.repeat)}
			aria-pressed={transport.repeat}
			aria-label="Repeat"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
				<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
			</svg>
		</button>
	</div>

	<!-- Inspect readout: the numbers you watch while working -->
	<div class="flex flex-1 items-end justify-end gap-4 sm:gap-6">
		<div class="text-right">
			<div class="text-[9px] tracking-widest text-gray-600 uppercase">Peak</div>
			<div class="font-mono text-xs text-gray-400 tabular-nums" data-testid="transport-peak">
				{values.peak === null || !isFinite(values.peak) ? '—' : values.peak.toFixed(1)}
			</div>
		</div>
		<div class="text-right">
			<div class="text-[9px] tracking-widest text-gray-600 uppercase">LUFS-M</div>
			<div
				class="font-mono text-xl leading-none tabular-nums sm:text-2xl {values.hovering
					? ''
					: 'text-gray-400'}"
				style={lufsStyle(values.momentary)}
				data-testid="transport-lufs-m"
			>
				{lufsText(values.momentary)}
			</div>
		</div>
		<div class="text-right">
			<div class="text-[9px] tracking-widest text-gray-600 uppercase">LUFS-S</div>
			<div
				class="font-mono text-xl leading-none tabular-nums sm:text-2xl {values.hovering
					? ''
					: 'text-gray-400'}"
				style={lufsStyle(values.shortTerm)}
				data-testid="transport-lufs-s"
			>
				{lufsText(values.shortTerm)}
			</div>
		</div>
	</div>
</section>
