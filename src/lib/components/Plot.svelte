<script lang="ts">
	import * as d3 from 'd3';
	import type { AudioFile } from '$lib/state/files.svelte';
	import type { FileResult } from '$lib/state/results.svelte';
	import { playback, play, togglePlayPause } from '$lib/audio/playback.svelte';

	type Props = {
		audioFile: AudioFile;
		result: FileResult;
		selectedBand: string;
		loudnessType: 'momentary' | 'shortTerm';
	};

	let { audioFile, result, selectedBand, loudnessType }: Props = $props();

	let container: HTMLDivElement;
	let containerWidth = $state(0);

	const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 };
	const HEIGHT = 180;

	const bandResult = $derived(result.bands.find((b) => b.label === selectedBand));
	const loudnessData = $derived(bandResult?.[loudnessType] ?? []);

	type HoverInfo = {
		time: number;
		momentary: number | null;
		shortTerm: number | null;
		peak: number | null;
	};

	let hoverInfo = $state<HoverInfo | null>(null);

	const isThisFileActive = $derived(playback.currentFileId === audioFile.id);
	const isThisFilePlaying = $derived(isThisFileActive && playback.isPlaying);

	const playheadLeft = $derived(
		playback.isPlaying && playback.currentFileId === audioFile.id
			? (playback.currentTime / audioFile.duration) *
					(containerWidth - MARGIN.left - MARGIN.right) +
				MARGIN.left
			: null
	);

	function nearestValue(data: [number, number][], timeMs: number): number | null {
		if (!data.length) return null;
		let best = data[0];
		for (const d of data) {
			if (Math.abs(d[0] - timeMs) < Math.abs(best[0] - timeMs)) best = d;
		}
		return best[1];
	}

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
	}

	function lufsColor(lufs: number): string {
		const stops: [number, string][] = [
			[-35, '#3b82f6'],
			[-30, '#3b82f6'],
			[-25, '#22c55e'],
			[-20, '#eab308'],
			[-15, '#ef4444'],
		];
		const clamped = Math.max(stops[0][0], Math.min(stops[stops.length - 1][0], lufs));
		for (let i = 0; i < stops.length - 1; i++) {
			const [d0, c0] = stops[i];
			const [d1, c1] = stops[i + 1];
			if (clamped <= d1) {
				return d3.interpolateRgb(c0, c1)((clamped - d0) / (d1 - d0));
			}
		}
		return stops[stops.length - 1][1];
	}

	function waveformEnvelope(buffer: AudioBuffer, width: number): { min: number; max: number }[] {
		const data = buffer.getChannelData(0);
		const spp = Math.max(1, Math.floor(data.length / width));
		return Array.from({ length: width }, (_, i) => {
			let min = 0,
				max = 0;
			for (let j = i * spp, end = Math.min(j + spp, data.length); j < end; j++) {
				if (data[j] < min) min = data[j];
				if (data[j] > max) max = data[j];
			}
			return { min, max };
		});
	}

	$effect(() => {
		if (!container || !audioFile.buffer) return;

		const width = container.clientWidth;
		const innerW = width - MARGIN.left - MARGIN.right;
		const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

		const lufsData = loudnessData;
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
			.call(d3.axisBottom(xScale).tickFormat((d) => formatTime(+d)).ticks(8))
			.call((ax) => ax.select('.domain').attr('stroke', '#3a3a3a'))
			.call((ax) => ax.selectAll('.tick line').attr('stroke', '#3a3a3a'))
			.call((ax) =>
				ax
					.selectAll('.tick text')
					.attr('fill', '#6a6a6a')
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
			.call((ax) => ax.select('.domain').attr('stroke', '#3a3a3a'))
			.call((ax) => ax.selectAll('.tick line').attr('stroke', '#3a3a3a'))
			.call((ax) =>
				ax
					.selectAll('.tick text')
					.attr('fill', '#6a6a6a')
					.style('font-family', 'monospace')
					.style('font-size', '10px')
			);

		// Waveform
		const envelope = waveformEnvelope(audioFile.buffer!, innerW);
		const areaGen = d3
			.area<{ min: number; max: number }>()
			.x((_, i) => i)
			.y0((d) => yWave(d.min))
			.y1((d) => yWave(d.max));

		g.append('path').datum(envelope).attr('d', areaGen).attr('fill', '#2a2a2a');

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
					color: lufsColor((d[1] + next[1]) / 2),
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
			.attr('stroke', '#ffffff22')
			.attr('stroke-width', 1)
			.attr('display', 'none');

		// Mouse overlay
		g.append('rect')
			.attr('width', innerW)
			.attr('height', innerH)
			.attr('fill', 'transparent')
			.style('cursor', 'crosshair')
			.on('click', (event) => {
				const [mx] = d3.pointer(event);
				const offsetSeconds = Math.max(0, xScale.invert(mx));
				const buffer =
					selectedBand === 'full'
						? audioFile.buffer
						: (audioFile.bandBuffers[selectedBand] ?? audioFile.buffer);
				if (buffer) play(audioFile.id, buffer, offsetSeconds);
			})
			.on('mousemove', (event) => {
				const [mx] = d3.pointer(event);
				const t = xScale.invert(mx);
				const timeMs = t * 1000;
				hoverLine.attr('x1', mx).attr('x2', mx).attr('display', null);
				hoverInfo = {
					time: t,
					momentary: nearestValue(br?.momentary ?? [], timeMs),
					shortTerm: nearestValue(br?.shortTerm ?? [], timeMs),
					peak: nearestValue(br?.peak ?? [], timeMs),
				};
			})
			.on('mouseleave', () => {
				hoverLine.attr('display', 'none');
				hoverInfo = null;
			});
	});
</script>

<div class="border-b border-[#3a3a3a]">
	<div class="flex items-center gap-3 px-3 py-2 border-b border-[#2a2a2a]">
		<button
			class="text-[#6a6a6a] hover:text-[#d4d0c8] transition-colors cursor-pointer"
			onclick={() => {
				if (isThisFileActive) {
					togglePlayPause();
				} else {
					const buffer =
						selectedBand === 'full'
							? audioFile.buffer
							: (audioFile.bandBuffers[selectedBand] ?? audioFile.buffer);
					if (buffer) play(audioFile.id, buffer, 0);
				}
			}}
		>
			{#if isThisFilePlaying}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
				</svg>
			{/if}
		</button>
		<span class="text-[#c8a84b] text-xs uppercase tracking-widest font-bold">
			{audioFile.artist ? `${audioFile.artist} — ` : ''}{audioFile.name}
		</span>
		<span class="text-[#3a3a3a] text-xs">{formatTime(audioFile.duration)}</span>
	</div>

	<div class="relative" bind:clientWidth={containerWidth}>
		<div bind:this={container} class="w-full bg-[#0f0f0f]"></div>
		{#if playheadLeft !== null}
			<div
				class="absolute top-0 w-px bg-white/40 pointer-events-none"
				style:left="{playheadLeft}px"
				style:top="{MARGIN.top}px"
				style:height="{HEIGHT - MARGIN.top - MARGIN.bottom}px"
			></div>
		{/if}
	</div>

	{#if hoverInfo}
		<div class="flex gap-6 px-3 py-1 border-t border-[#2a2a2a] text-[10px] font-mono text-[#888]">
			<span>TIME {formatTime(hoverInfo.time)}</span>
			<span>PEAK {hoverInfo.peak?.toFixed(1) ?? '—'} dBFS</span>
			<span>MOMENTARY {hoverInfo.momentary?.toFixed(1) ?? '—'} LUFS</span>
			<span>SHORT-TERM {hoverInfo.shortTerm?.toFixed(1) ?? '—'} LUFS</span>
		</div>
	{:else}
		<div class="px-3 py-1 border-t border-[#2a2a2a] text-[10px] font-mono text-[#3a3a3a]">
			HOVER TO INSPECT
		</div>
	{/if}
</div>
