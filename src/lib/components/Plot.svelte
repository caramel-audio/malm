<script lang="ts">
	import * as d3 from 'd3';
	import type { AudioFile } from '$lib/state/files.svelte';
	import { nearestValue, type FileResult } from '$lib/state/results.svelte';
	import { playback } from '$lib/audio/playback.svelte';
	import { transport, playTrack } from '$lib/audio/transport.svelte';
	import { options, type LoudnessType } from '$lib/state/options.svelte';
	import {
		formatTime,
		lufsColor,
		balanceColor,
		correlationColor,
		formatSignedDb,
		formatCorrelation
	} from '$lib/format';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		selectedBand: string;
		loudnessType: LoudnessType;
		lufsOffset?: number;
	};

	let { audioFile, result, selectedBand, loudnessType, lufsOffset = 0 }: Props = $props();

	/**
	 * Everything that differs between the four curves the plot can draw.
	 *
	 * `rank` picks the survivor when a pixel bucket holds many points: loudest for
	 * a loudness curve, furthest off centre for balance, *worst* for correlation —
	 * keeping the maximum there would hide the anti-phase moment you are looking
	 * for. `edges` names the two ends of a symmetric axis, since "+0.4" and "-1.2"
	 * mean nothing on their own.
	 *
	 * The stereo axes are fixed rather than autoscaled so two tracks side by side
	 * are equally crooked at equal slope; values past the edge clamp, and the
	 * header carries the true number.
	 */
	type View = {
		domain: [number, number];
		ticks: number[];
		color: (v: number) => string;
		label: (v: number) => string;
		rank: (v: number) => number;
		/** Whether the per-file normalization offset applies to this curve. */
		offset: boolean;
		edges?: [string, string];
	};

	const LUFS_VIEW: View = {
		domain: [-45, -5],
		ticks: [-40, -35, -30, -25, -20, -15, -10],
		color: lufsColor,
		label: (v) => v.toFixed(1),
		rank: (v) => v,
		offset: true
	};

	const VIEWS: Record<LoudnessType, View> = {
		momentary: LUFS_VIEW,
		shortTerm: LUFS_VIEW,
		balance: {
			domain: [-6, 6],
			ticks: [-6, -3, 0, 3, 6],
			color: balanceColor,
			label: formatSignedDb,
			rank: Math.abs,
			// A per-file gain offset cancels out of a difference between two channels.
			offset: false,
			edges: ['L', 'R']
		},
		correlation: {
			domain: [-1, 1],
			ticks: [-1, -0.5, 0, 0.5, 1],
			color: correlationColor,
			label: formatCorrelation,
			rank: (v) => -v,
			offset: false,
			edges: ['in phase', 'anti phase']
		}
	};

	const view = $derived(VIEWS[loudnessType]);
	const symmetric = $derived(view.edges !== undefined);
	const appliedOffset = $derived(view.offset ? lufsOffset : 0);

	const pinned = $derived(options.pinnedFileId === audioFile.id);

	let container: HTMLDivElement;
	let containerWidth = $state(0);

	const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 };
	const HEIGHT = 180;

	const bandResult = $derived(result.bands.find((b) => b.label === selectedBand));
	const loudnessData = $derived(bandResult?.[loudnessType] ?? []);

	const integratedLufs = $derived(
		(result.bands.find((b) => b.label === 'full') ?? result.bands[0])?.integrated
	);

	// Header number follows the selected band: "is *this band* crooked / out of
	// phase" is the question the stereo views are there to answer.
	const integratedStereo = $derived(
		loudnessType === 'balance' ? bandResult?.balanceIntegrated : bandResult?.correlationIntegrated
	);

	const playheadLeft = $derived(
		playback.isPlaying && playback.currentFileId === audioFile.id
			? (playback.currentTime / audioFile.duration) *
					(containerWidth - MARGIN.left - MARGIN.right) +
					MARGIN.left
			: null
	);

	const innerW = $derived(Math.max(0, containerWidth - MARGIN.left - MARGIN.right));
	const markers = $derived(options.markers[audioFile.id] ?? []);

	function markerLeft(t: number): number {
		return MARGIN.left + (t / audioFile.duration) * innerW;
	}

	function markerValue(t: number): number | null {
		const v = nearestValue(bandResult?.[loudnessType] ?? [], t * 1000);
		return v === null ? null : v + appliedOffset;
	}

	function removeMarker(t: number): void {
		const rest = markers.filter((m) => m !== t);
		if (rest.length) options.markers[audioFile.id] = rest;
		else delete options.markers[audioFile.id];
	}

	// Rebucket the stored 100 ms min/max peak file down to one entry per pixel.
	function waveformEnvelope(
		waveform: [number, number][],
		width: number
	): { min: number; max: number }[] {
		const per = waveform.length / width;
		return Array.from({ length: width }, (_, i) => {
			const start = Math.floor(i * per);
			const end = Math.max(start + 1, Math.floor((i + 1) * per));
			let min = 0,
				max = 0;
			for (let j = start; j < end && j < waveform.length; j++) {
				if (waveform[j][0] < min) min = waveform[j][0];
				if (waveform[j][1] > max) max = waveform[j][1];
			}
			return { min, max };
		});
	}

	// One point per pixel bucket, keeping whichever `view.rank` rates highest — a
	// 3 h track has ~108k points and drawing a line segment per point locks up the
	// browser.
	function decimateLufs(
		data: [number, number][],
		width: number,
		rank: (v: number) => number
	): [number, number][] {
		if (data.length <= width * 2 || width <= 0) return data;
		const per = data.length / width;
		const out: [number, number][] = [];
		for (let i = 0; i < width; i++) {
			const start = Math.floor(i * per);
			const end = Math.max(start + 1, Math.floor((i + 1) * per));
			let best = data[start];
			for (let j = start + 1; j < end && j < data.length; j++) {
				if (rank(data[j][1]) > rank(best[1])) best = data[j];
			}
			out.push(best);
		}
		return out;
	}

	$effect(() => {
		if (!container) return;

		const width = container.clientWidth;
		const innerW = width - MARGIN.left - MARGIN.right;
		const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

		const v = view;
		const offset = appliedOffset;
		const lufsData = decimateLufs(loudnessData, innerW, v.rank).map(
			([t, value]) => [t, value + offset] as [number, number]
		);
		const br = bandResult;

		d3.select(container).selectAll('svg').remove();

		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', width)
			.attr('height', HEIGHT)
			.style('display', 'block');

		const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

		const xScale = d3.scaleLinear().domain([0, audioFile.duration]).range([0, innerW]);
		const yWave = d3.scaleLinear().domain([-1, 1]).range([innerH, 0]);
		const yLufs = d3.scaleLinear().domain(v.domain).range([innerH, 0]).clamp(symmetric);

		g.append('g')
			.attr('transform', `translate(0,${innerH})`)
			.call(
				d3
					.axisBottom(xScale)
					.tickFormat((d) => formatTime(+d))
					.ticks(8)
			)
			.call((ax) => ax.select('.domain').attr('stroke', '#4d4d4d'))
			.call((ax) => ax.selectAll('.tick line').attr('stroke', '#4d4d4d'))
			.call((ax) =>
				ax
					.selectAll('.tick text')
					.attr('fill', '#999999')
					.style('font-family', 'monospace')
					.style('font-size', '10px')
			);

		g.append('g')
			.call(
				d3
					.axisLeft(yLufs)
					.tickValues(v.ticks)
					.tickFormat((d) => v.label(+d))
			)
			.call((ax) => ax.select('.domain').attr('stroke', '#4d4d4d'))
			.call((ax) => ax.selectAll('.tick line').attr('stroke', '#4d4d4d'))
			.call((ax) =>
				ax
					.selectAll('.tick text')
					.attr('fill', '#999999')
					.style('font-family', 'monospace')
					.style('font-size', '10px')
			);

		// Waveform (absent from results saved before streaming analysis)
		if (result.waveform?.length) {
			const envelope = waveformEnvelope(result.waveform, innerW);
			const areaGen = d3
				.area<{ min: number; max: number }>()
				.x((_, i) => i)
				.y0((d) => yWave(d.min))
				.y1((d) => yWave(d.max));

			g.append('path').datum(envelope).attr('d', areaGen).attr('fill', '#333333');
		}

		// Centre line, with the ends named — "+1.5" means nothing without it
		if (v.edges) {
			g.append('line')
				.attr('x1', 0)
				.attr('x2', innerW)
				.attr('y1', yLufs(0))
				.attr('y2', yLufs(0))
				.attr('stroke', '#6b7280')
				.attr('stroke-dasharray', '3 3');

			for (const [label, edge] of [
				[v.edges[0], v.domain[1]],
				[v.edges[1], v.domain[0]]
			] as const) {
				g.append('text')
					.attr('x', 4)
					.attr('y', yLufs(edge) + (edge > 0 ? 10 : -3))
					.attr('fill', '#6b7280')
					.style('font-family', 'monospace')
					.style('font-size', '10px')
					.text(label);
			}
		}

		// Loudness colored segments
		if (lufsData.length > 1) {
			type Segment = { x1: number; y1: number; x2: number; y2: number; color: string };
			const segments: Segment[] = lufsData.slice(0, -1).map((d, i) => {
				const next = lufsData[i + 1];
				return {
					x1: xScale(d[0] / 1000),
					y1: yLufs(d[1]),
					x2: xScale(next[0] / 1000),
					y2: yLufs(next[1]),
					color: v.color((d[1] + next[1]) / 2)
				};
			});

			g.append('g')
				.selectAll<SVGLineElement, Segment>('line')
				.data(segments)
				.join('line')
				.attr('x1', (d) => d.x1)
				.attr('y1', (d) => d.y1)
				.attr('x2', (d) => d.x2)
				.attr('y2', (d) => d.y2)
				.attr('stroke', (d) => d.color)
				.attr('stroke-width', 2);
		}

		// Hover line
		const hoverLine = g
			.append('line')
			.attr('y1', 0)
			.attr('y2', innerH)
			.attr('stroke', '#ffffff33')
			.attr('stroke-width', 1)
			.attr('display', 'none');

		const hoverLabel = g
			.append('text')
			.attr('y', innerH - 4)
			.style('font-family', 'monospace')
			.style('font-size', '10px')
			.attr('text-anchor', 'middle')
			.attr('pointer-events', 'none')
			.attr('display', 'none');

		// Mouse overlay
		g.append('rect')
			.attr('width', innerW)
			.attr('height', innerH)
			.attr('fill', 'transparent')
			.style('cursor', 'crosshair')
			.on('click', (event) => {
				const [mx] = d3.pointer(event);
				playTrack(audioFile.id, Math.max(0, xScale.invert(mx)));
			})
			.on('contextmenu', (event) => {
				event.preventDefault();
				const [mx] = d3.pointer(event);
				const t = Math.min(audioFile.duration, Math.max(0, xScale.invert(mx)));
				const existing = options.markers[audioFile.id] ?? [];
				options.markers[audioFile.id] = [...existing, t].sort((a, b) => a - b);
			})
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const t = xScale.invert(mx);
				const timeMs = t * 1000;
				const mom = nearestValue(br?.momentary ?? [], timeMs);
				const st = nearestValue(br?.shortTerm ?? [], timeMs);
				const pk = nearestValue(br?.peak ?? [], timeMs);
				const lufsVal =
					loudnessType === 'momentary'
						? mom
						: loudnessType === 'shortTerm'
							? st
							: nearestValue(br?.[loudnessType] ?? [], timeMs);
				const lufsValOffset = lufsVal !== null ? lufsVal + offset : null;
				hoverLine.attr('x1', mx).attr('x2', mx).attr('display', null);
				hoverLabel
					.attr('x', mx)
					.attr('fill', lufsValOffset !== null ? v.color(lufsValOffset) : '#ffffff88')
					.text(lufsValOffset !== null ? v.label(lufsValOffset) : '')
					.attr('display', lufsVal !== null ? null : 'none');
				transport.hover = {
					fileId: audioFile.id,
					time: t,
					momentary: mom,
					shortTerm: st,
					peak: pk
				};
			})
			.on('mouseleave', () => {
				hoverLine.attr('display', 'none');
				hoverLabel.attr('display', 'none');
				if (transport.hover?.fileId === audioFile.id) transport.hover = null;
			});
	});
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
		{#if lufsOffset !== 0}
			<span class="shrink-0 font-mono text-xs text-gray-400"
				>{lufsOffset > 0 ? '+' : ''}{lufsOffset.toFixed(1)} dB</span
			>
		{/if}
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
		{#if symmetric}
			{#if integratedStereo !== undefined && isFinite(integratedStereo)}
				<span
					class="shrink-0 font-mono text-xs"
					style:color={view.color(integratedStereo)}
					data-testid="plot-stereo"
					title={loudnessType === 'balance'
						? 'Gated L/R difference for this band'
						: 'Pooled L/R correlation for this band'}
					>{loudnessType === 'balance'
						? `L/R: ${formatSignedDb(integratedStereo)} dB`
						: `r: ${formatCorrelation(integratedStereo)}`}</span
				>
			{:else}
				<span class="shrink-0 font-mono text-xs text-gray-600">mono</span>
			{/if}
		{:else if integratedLufs !== undefined && isFinite(integratedLufs)}
			<span class="shrink-0 font-mono text-xs text-gray-400"
				>LUFS-I: {integratedLufs.toFixed(1)}</span
			>
		{/if}
		<span class="shrink-0 text-xs text-gray-500">{formatTime(audioFile.duration)}</span>
	</div>

	<div class="relative" bind:clientWidth={containerWidth}>
		<div bind:this={container} data-testid="plot" class="w-full bg-gray-950"></div>
		{#each markers as t (t)}
			{@const value = markerValue(t)}
			<div
				data-testid="marker"
				class="group absolute w-[9px] -translate-x-1/2"
				style:left="{markerLeft(t)}px"
				style:top="{MARGIN.top}px"
				style:height="{HEIGHT - MARGIN.top - MARGIN.bottom}px"
			>
				<div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/60"></div>
				{#if value !== null}
					<!-- Same font/size/baseline as the d3 hover label. -->
					<span
						class="pointer-events-none absolute bottom-[1px] left-1/2 -translate-x-1/2 rounded-sm bg-gray-950/85 px-1 py-[2px] leading-none"
						style:font-family="monospace"
						style:font-size="10px"
						style:color={view.color(value)}>{view.label(value)}</span
					>
				{/if}
				<button
					class="absolute -top-2 left-1/2 hidden h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-gray-800 text-sm leading-none text-gray-300 group-hover:flex hover:bg-gray-700 hover:text-white"
					onclick={() => removeMarker(t)}
					aria-label="Remove marker at {formatTime(t)}">×</button
				>
			</div>
		{/each}
		{#if playheadLeft !== null}
			<div
				class="pointer-events-none absolute top-0 w-px bg-white/40"
				style:left="{playheadLeft}px"
				style:top="{MARGIN.top}px"
				style:height="{HEIGHT - MARGIN.top - MARGIN.bottom}px"
			></div>
		{/if}
	</div>
</div>
