// Playback streams from an <audio> element instead of an AudioBuffer, so a
// multi-hour track costs nothing in memory. The same LR4 filter pairs used by
// analysis are applied live.

import { buildBandCoeffs, type FreqBand, type Slope } from './filters';

export const playback = $state({
	currentFileId: null as string | null,
	currentTime: 0,
	isPlaying: false,
	isPaused: false
});

let ctx: AudioContext | null = null;
let audioEl: HTMLAudioElement | null = null;
// createMediaElementSource may only be called once per element — created with it.
let sourceNode: MediaElementAudioSourceNode | null = null;
let filterNodes: AudioNode[] = [];
let gainNode: GainNode | null = null;
let objectUrl: string | null = null;
let loadedFileId: string | null = null;
let rafId: number | null = null;

function tick() {
	if (audioEl && playback.isPlaying) {
		playback.currentTime = audioEl.currentTime;
		rafId = requestAnimationFrame(tick);
	}
}

function reset() {
	if (rafId !== null) cancelAnimationFrame(rafId);
	rafId = null;
	playback.isPlaying = false;
	playback.isPaused = false;
	playback.currentFileId = null;
	playback.currentTime = 0;
}

function ensureGraph(): { ctx: AudioContext; audioEl: HTMLAudioElement } {
	if (!ctx) ctx = new AudioContext();
	if (!audioEl) {
		audioEl = new Audio();
		audioEl.preload = 'metadata';
		audioEl.addEventListener('ended', reset);
		sourceNode = ctx.createMediaElementSource(audioEl);
	}
	return { ctx, audioEl };
}

// IIR nodes rather than BiquadFilterNodes: they take the analysis coefficients
// verbatim, so what you hear is what was measured — and they can express the
// first-order sections an LR12 crossover needs.
function rebuildChain(ctx: AudioContext, band: FreqBand | null, slope: Slope, gainDb: number) {
	sourceNode!.disconnect();
	for (const n of filterNodes) n.disconnect();
	filterNodes = [];
	gainNode?.disconnect();

	gainNode = ctx.createGain();
	gainNode.gain.value = Math.pow(10, gainDb / 20);

	let lastNode: AudioNode = sourceNode!;
	if (band) {
		for (const c of buildBandCoeffs(band, ctx.sampleRate, slope)) {
			const node = ctx.createIIRFilter([c.b0, c.b1, c.b2], [1, c.a1, c.a2]);
			lastNode.connect(node);
			filterNodes.push(node);
			lastNode = node;
		}
	}
	lastNode.connect(gainNode);
	gainNode.connect(ctx.destination);
}

export function play(
	fileId: string,
	file: File,
	band: FreqBand | null,
	slope: Slope,
	offsetSeconds: number,
	gainDb = 0
): void {
	const { ctx, audioEl } = ensureGraph();
	if (ctx.state === 'suspended') ctx.resume();

	if (loadedFileId !== fileId) {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(file);
		loadedFileId = fileId;
		audioEl.src = objectUrl;
	}

	rebuildChain(ctx, band, slope, gainDb);

	const offset = Math.max(0, offsetSeconds);
	const start = () => {
		audioEl.currentTime = offset;
		audioEl.play();
	};
	// Seeking before metadata is known throws — wait for it if the src is fresh.
	if (audioEl.readyState >= HTMLMediaElement.HAVE_METADATA) start();
	else audioEl.addEventListener('loadedmetadata', start, { once: true });

	if (rafId !== null) cancelAnimationFrame(rafId);
	playback.currentFileId = fileId;
	playback.currentTime = offset;
	playback.isPlaying = true;
	playback.isPaused = false;
	rafId = requestAnimationFrame(tick);
}

export async function pause(): Promise<void> {
	if (!audioEl || !playback.isPlaying) return;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	audioEl.pause();
	playback.isPlaying = false;
	playback.isPaused = true;
}

export async function resume(): Promise<void> {
	if (!audioEl || !playback.isPaused) return;
	if (ctx?.state === 'suspended') await ctx.resume();
	await audioEl.play();
	playback.isPlaying = true;
	playback.isPaused = false;
	rafId = requestAnimationFrame(tick);
}

export function setGain(gainDb: number): void {
	if (gainNode && ctx) {
		gainNode.gain.setTargetAtTime(Math.pow(10, gainDb / 20), ctx.currentTime, 0.05);
	}
}

export async function togglePlayPause(): Promise<void> {
	if (playback.isPlaying) await pause();
	else if (playback.isPaused) await resume();
}

export function stop(): void {
	audioEl?.pause();
	reset();
}
