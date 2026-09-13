<script lang="ts">
	import * as d3 from 'd3';
	import type { AudioFile } from '$lib/state/files.svelte';
	import { nearestValue, type FileResult } from '$lib/state/results.svelte';
	import { playback } from '$lib/audio/playback.svelte';
	import { transport, playTrack } from '$lib/audio/transport.svelte';
	import { formatTime, lufsColor } from '$lib/format';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		selectedBand: string;
		loudnessType: 'momentary' | 'shortTerm';
		lufsOffset?: number;
	};

	let { audioFile, result, selectedBand, loudnessType, lufsOffset = 0 }: Props = $props();

	let container: HTMLDivElement;
	let containerWidth = $state(0);

	const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 };
	const HEIGHT = 180;

	const bandResult = $derived(result.bands.find((b) => b.label === selectedBand));
	const loudnessData = $derived(bandResult?.[loudnessType] ?? []);

	const integratedLufs = $derived(
		(result.bands.find((b) => b.label === 'full') ?? result.bands[0])?.integrated
	);

	const playheadLeft = $derived(
		playback.isPlaying && playback.currentFileId === audioFile.id
			? (playback.currentTime / audioFile.duration) *
					(containerWidth - MARGIN.left - MARGIN.right) +
					MARGIN.left
			: null
	);

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

	// One point per pixel bucket, keeping the loudest — a 3 h track has ~108k
	// points and drawing a line segment per point locks up the browser.
	function decimateLufs(data: [number, number][], width: number): [number, number][] {
		if (data.length <= width * 2 || width <= 0) return data;
		const per = data.length / width;
		const out: [number, number][] = [];
		for (let i = 0; i < width; i++) {
			const start = Math.floor(i * per);
			const end = Math.max(start + 1, Math.floor((i + 1) * per));
			let best = data[start];
			for (let j = start + 1; j < end && j < data.length; j++) {
				if (data[j][1] > best[1]) best = data[j];
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

		const offset = lufsOffset;
		const lufsData = decimateLufs(loudnessData, innerW).map(
			([t, v]) => [t, v + offset] as [number, number]
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
		const yLufs = d3.scaleLinear().domain([-45, -5]).range([innerH, 0]);

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
					.tickValues([-40, -35, -30, -25, -20, -15, -10])
					.tickFormat((d) => `${d}`)
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
					color: lufsColor((d[1] + next[1]) / 2)
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
			.attr('y', 12)
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
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const t = xScale.invert(mx);
				const timeMs = t * 1000;
				const mom = nearestValue(br?.momentary ?? [], timeMs);
				const st = nearestValue(br?.shortTerm ?? [], timeMs);
				const pk = nearestValue(br?.peak ?? [], timeMs);
				const lufsVal = loudnessType === 'momentary' ? mom : st;
				const lufsValOffset = lufsVal !== null ? lufsVal + offset : null;
				hoverLine.attr('x1', mx).attr('x2', mx).attr('display', null);
				hoverLabel
					.attr('x', mx)
					.attr('fill', lufsValOffset !== null ? lufsColor(lufsValOffset) : '#ffffff88')
					.text(lufsValOffset !== null ? lufsValOffset.toFixed(1) : '')
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
		{#if lufsOffset !== 0}
			<span class="shrink-0 font-mono text-xs text-gray-400"
				>{lufsOffset > 0 ? '+' : ''}{lufsOffset.toFixed(1)} dB</span
			>
		{/if}
		<span
			class="min-w-0 flex-1 truncate text-xs font-bold tracking-widest text-secondary-400 uppercase"
			>{audioFile.name}</span
		>
		{#if audioFile.artist}
			<span class="shrink-0 text-xs tracking-widest text-gray-500 uppercase"
				>{audioFile.artist}</span
			>
		{/if}
		{#if integratedLufs !== undefined && isFinite(integratedLufs)}
			<span class="shrink-0 font-mono text-xs text-gray-400"
				>LUFS-I: {integratedLufs.toFixed(1)}</span
			>
		{/if}
		<span class="shrink-0 text-xs text-gray-500">{formatTime(audioFile.duration)}</span>
	</div>

	<div class="relative" bind:clientWidth={containerWidth}>
		<div bind:this={container} data-testid="plot" class="w-full bg-gray-950"></div>
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
