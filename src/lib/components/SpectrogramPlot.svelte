<script lang="ts">
	import * as d3 from 'd3';
	import type { AudioFile } from '$lib/state/files.svelte';
	import type { FileResult } from '$lib/state/results.svelte';
	import { byteDb, decodeBytes, frequencyBin, type Spectrogram } from '$lib/audio/spectrogram';
	import { playback } from '$lib/audio/playback.svelte';
	import { playTrack } from '$lib/audio/transport.svelte';
	import { options } from '$lib/state/options.svelte';
	import { formatTime } from '$lib/format';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		logFreq: boolean;
		height?: number;
	};

	let { audioFile, result, logFreq, height = 300 }: Props = $props();

	const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 };
	/** Log axis cannot start at DC. */
	const LOG_MIN_HZ = 20;
	/** dB window the colour ramp spans — below is black, above is full brightness. */
	const DB_MIN = -105;
	const DB_MAX = 0;

	// byte -> rgb, so the per-pixel loop below is a single lookup.
	const LUT = (() => {
		const lut = new Uint8Array(256 * 3);
		for (let b = 0; b < 256; b++) {
			const t = Math.max(0, Math.min(1, (byteDb(b) - DB_MIN) / (DB_MAX - DB_MIN)));
			const { r, g, b: blue } = d3.rgb(d3.interpolateMagma(t));
			lut[b * 3] = r;
			lut[b * 3 + 1] = g;
			lut[b * 3 + 2] = blue;
		}
		return lut;
	})();

	const spec = $derived(result.spectrogram ?? null);
	const bytes = $derived(spec ? decodeBytes(spec.data) : null);

	const pinned = $derived(options.pinnedFileId === audioFile.id);

	let containerWidth = $state(0);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let axes = $state<SVGSVGElement | null>(null);
	let hover = $state<{ x: number; time: number; hz: number; db: number } | null>(null);

	const innerW = $derived(Math.max(0, containerWidth - MARGIN.left - MARGIN.right));
	const innerH = $derived(Math.max(0, height - MARGIN.top - MARGIN.bottom));

	const topHz = $derived(spec?.maxFrequency ?? 22050);

	/** Frequency axis. Shared by the image, the ticks and the hover readout. */
	const yScale = $derived(
		logFreq
			? d3.scaleLog().domain([LOG_MIN_HZ, topHz]).range([innerH, 0])
			: d3.scaleLinear().domain([0, topHz]).range([innerH, 0])
	);

	const xScale = $derived(d3.scaleLinear().domain([0, audioFile.duration]).range([0, innerW]));

	const playheadLeft = $derived(
		playback.isPlaying && playback.currentFileId === audioFile.id
			? (playback.currentTime / audioFile.duration) * innerW + MARGIN.left
			: null
	);

	function formatHz(hz: number): string {
		return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k` : `${Math.round(hz)}`;
	}

	/** Loudest stored bin covering the pixel row `y`, as a byte. */
	function sampleColumn(
		data: Uint8Array,
		s: Spectrogram,
		colStart: number,
		colEnd: number,
		binStart: number,
		binEnd: number
	): number {
		let best = 0;
		for (let c = colStart; c < colEnd; c++) {
			const base = c * s.bins;
			for (let b = binStart; b < binEnd; b++) {
				const v = data[base + b];
				if (v > best) best = v;
			}
		}
		return best;
	}

	$effect(() => {
		const s = spec;
		const data = bytes;
		const w = innerW;
		const h = innerH;
		const c = canvas;
		if (!c) return;

		c.width = Math.max(1, containerWidth);
		c.height = Math.max(1, height);
		const ctx = c.getContext('2d');
		if (!ctx || !s || !data || w === 0 || h === 0) return;

		const y = yScale;

		// Which stored columns / bins each destination pixel covers. Ranges rather
		// than a single sample: at 512 bins into ~250 px a nearest-neighbour pick
		// would drop the one-bin-thick edge a codec cutoff shows up as.
		const colRanges = new Uint32Array(w * 2);
		for (let x = 0; x < w; x++) {
			const start = Math.min(s.columns - 1, Math.floor((x / w) * s.columns));
			const end = Math.max(start + 1, Math.min(s.columns, Math.floor(((x + 1) / w) * s.columns)));
			colRanges[x * 2] = start;
			colRanges[x * 2 + 1] = end;
		}

		const binRanges = new Uint32Array(h * 2);
		for (let py = 0; py < h; py++) {
			const hiHz = y.invert(py);
			const loHz = y.invert(py + 1);
			const start = Math.max(0, Math.min(s.bins - 1, Math.floor(frequencyBin(s, loHz))));
			const end = Math.max(start + 1, Math.min(s.bins, Math.ceil(frequencyBin(s, hiHz)) + 1));
			binRanges[py * 2] = start;
			binRanges[py * 2 + 1] = end;
		}

		const img = ctx.createImageData(w, h);
		const px = img.data;
		for (let py = 0; py < h; py++) {
			const binStart = binRanges[py * 2];
			const binEnd = binRanges[py * 2 + 1];
			let o = py * w * 4;
			for (let x = 0; x < w; x++, o += 4) {
				const byte = sampleColumn(
					data,
					s,
					colRanges[x * 2],
					colRanges[x * 2 + 1],
					binStart,
					binEnd
				);
				px[o] = LUT[byte * 3];
				px[o + 1] = LUT[byte * 3 + 1];
				px[o + 2] = LUT[byte * 3 + 2];
				px[o + 3] = 255;
			}
		}
		ctx.putImageData(img, MARGIN.left, MARGIN.top);
	});

	$effect(() => {
		if (!axes) return;
		const h = innerH;
		const y = yScale;
		const x = xScale;

		const svg = d3.select(axes);
		svg.selectAll('g').remove();

		const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		const style = (ax: d3.Selection<SVGGElement, unknown, null, undefined>) =>
			ax
				.call((a) => a.select('.domain').attr('stroke', '#4d4d4d'))
				.call((a) => a.selectAll('.tick line').attr('stroke', '#4d4d4d'))
				.call((a) =>
					a
						.selectAll('.tick text')
						.attr('fill', '#999999')
						.style('font-family', 'monospace')
						.style('font-size', '10px')
				);

		style(
			g
				.append('g')
				.attr('transform', `translate(0,${h})`)
				.call(
					d3
						.axisBottom(x)
						.tickFormat((d) => formatTime(+d))
						.ticks(8)
				)
		);

		const ticks = logFreq
			? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((f) => f <= y.domain()[1])
			: y.ticks(6);

		style(
			g.append('g').call(
				d3
					.axisLeft(y)
					.tickValues(ticks)
					.tickFormat((d) => formatHz(+d))
			)
		);
	});

	function onmove(event: MouseEvent) {
		const s = spec;
		const data = bytes;
		if (!s || !data) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const mx = event.clientX - rect.left;
		const my = event.clientY - rect.top;
		const time = Math.max(0, Math.min(audioFile.duration, xScale.invert(mx)));
		const hz = Math.max(0, Math.min(topHz, yScale.invert(my)));

		const col = Math.max(0, Math.min(s.columns - 1, Math.floor((mx / innerW) * s.columns)));
		const bin = Math.max(0, Math.min(s.bins - 1, Math.round(frequencyBin(s, hz))));
		hover = { x: mx, time, hz, db: byteDb(data[col * s.bins + bin]) };
	}
</script>

<div class="border-b border-gray-700">
	<div class="flex items-center gap-3 border-b border-gray-800 px-3 py-2">
		<button
			class="shrink-0 {pinned ? 'text-secondary-400' : 'text-gray-700 hover:text-gray-400'}"
			onclick={() => (options.pinnedFileId = pinned ? null : audioFile.id)}
			aria-label="{pinned ? 'Unpin' : 'Pin'} {audioFile.name}"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
				<path d="M14 2l8 8-3 1-3 3-1 6-3-4-5 5-1 1 1-2 5-5-4-3 6-1 3-3z" />
			</svg>
		</button>
		<span
			class="max-w-[50%] truncate text-xs font-bold tracking-widest text-secondary-400 uppercase"
			>{audioFile.name}</span
		>
		{#if audioFile.artist}
			<span class="min-w-0 flex-1 truncate text-xs tracking-widest text-gray-500 uppercase"
				>{audioFile.artist}</span
			>
		{:else}
			<span class="flex-1"></span>
		{/if}
		{#if hover}
			<span
				class="shrink-0 font-mono text-xs text-fft-400"
				data-testid="spectrogram-readout"
				data-hz={Math.round(hover.hz)}>{formatHz(hover.hz)}Hz {hover.db.toFixed(0)} dB</span
			>
		{:else if audioFile.sampleRate}
			<!-- The sample rate is the ceiling of the picture, so it belongs here. -->
			<span class="shrink-0 font-mono text-xs text-gray-500"
				>{(audioFile.sampleRate / 1000).toFixed(1)} kHz</span
			>
		{/if}
		<span class="shrink-0 text-xs text-gray-500">{formatTime(audioFile.duration)}</span>
	</div>

	<div class="relative bg-gray-950" bind:clientWidth={containerWidth} style:height="{height}px">
		<canvas bind:this={canvas} data-testid="spectrogram" class="absolute inset-0 h-full w-full"
		></canvas>
		<svg
			bind:this={axes}
			class="pointer-events-none absolute inset-0"
			width={containerWidth}
			{height}
		></svg>

		{#if spec}
			<!-- Seek surface. Keyboard control lives in the transport bar, same as the
			     loudness plots. -->
			<div
				class="absolute cursor-crosshair"
				style:left="{MARGIN.left}px"
				style:top="{MARGIN.top}px"
				style:width="{innerW}px"
				style:height="{innerH}px"
				role="presentation"
				onmousemove={onmove}
				onmouseleave={() => (hover = null)}
				onclick={(e) => {
					const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
					playTrack(audioFile.id, Math.max(0, xScale.invert(e.clientX - rect.left)));
				}}
			></div>
		{:else}
			<div
				class="absolute inset-0 flex items-center justify-center text-xs tracking-widest text-gray-600 uppercase"
			>
				No spectrogram
			</div>
		{/if}

		{#if hover}
			<div
				class="pointer-events-none absolute w-px bg-white/40"
				style:left="{MARGIN.left + hover.x}px"
				style:top="{MARGIN.top}px"
				style:height="{innerH}px"
			></div>
			<div
				class="pointer-events-none absolute h-px bg-fft-400/60"
				style:left="{MARGIN.left}px"
				style:top="{MARGIN.top + yScale(Math.max(hover.hz, logFreq ? LOG_MIN_HZ : 0))}px"
				style:width="{innerW}px"
			></div>
		{/if}

		{#if playheadLeft !== null}
			<div
				class="pointer-events-none absolute w-px bg-white/60"
				style:left="{playheadLeft}px"
				style:top="{MARGIN.top}px"
				style:height="{innerH}px"
			></div>
		{/if}
	</div>
</div>
