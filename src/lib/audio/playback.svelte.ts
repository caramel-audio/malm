import type { FreqBand } from './filters';

export const playback = $state({
	currentFileId: null as string | null,
	currentTime: 0,
	isPlaying: false,
	isPaused: false,
});

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let startContextTime = 0;
let startOffset = 0;
let rafId: number | null = null;

function tick() {
	if (ctx && playback.isPlaying) {
		playback.currentTime = startOffset + (ctx.currentTime - startContextTime);
		rafId = requestAnimationFrame(tick);
	}
}

export function play(fileId: string, buffer: AudioBuffer, band: FreqBand | null, offsetSeconds: number, gainDb = 0): void {
	stop();

	if (!ctx) ctx = new AudioContext();
	if (ctx.state === 'suspended') ctx.resume();

	source = ctx.createBufferSource();
	source.buffer = buffer;

	gainNode = ctx.createGain();
	gainNode.gain.value = Math.pow(10, gainDb / 20);

	let lastNode: AudioNode = source;
	if (band && (band.lowHz !== null || band.highHz !== null)) {
		if (band.lowHz !== null) {
			const hp1 = ctx.createBiquadFilter();
			hp1.type = 'highpass';
			hp1.frequency.value = band.lowHz;
			hp1.Q.value = Math.SQRT1_2;
			const hp2 = ctx.createBiquadFilter();
			hp2.type = 'highpass';
			hp2.frequency.value = band.lowHz;
			hp2.Q.value = Math.SQRT1_2;
			lastNode.connect(hp1);
			hp1.connect(hp2);
			lastNode = hp2;
		}
		if (band.highHz !== null) {
			const lp1 = ctx.createBiquadFilter();
			lp1.type = 'lowpass';
			lp1.frequency.value = band.highHz;
			lp1.Q.value = Math.SQRT1_2;
			const lp2 = ctx.createBiquadFilter();
			lp2.type = 'lowpass';
			lp2.frequency.value = band.highHz;
			lp2.Q.value = Math.SQRT1_2;
			lastNode.connect(lp1);
			lp1.connect(lp2);
			lastNode = lp2;
		}
	}
	lastNode.connect(gainNode);
	gainNode.connect(ctx.destination);

	startContextTime = ctx.currentTime;
	startOffset = Math.max(0, offsetSeconds);

	source.start(0, startOffset);
	source.onended = () => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
		source = null;
		playback.isPlaying = false;
		playback.isPaused = false;
		playback.currentFileId = null;
		playback.currentTime = 0;
	};

	playback.currentFileId = fileId;
	playback.currentTime = startOffset;
	playback.isPlaying = true;
	playback.isPaused = false;

	rafId = requestAnimationFrame(tick);
}

export async function pause(): Promise<void> {
	if (!ctx || !playback.isPlaying) return;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	await ctx.suspend();
	playback.isPlaying = false;
	playback.isPaused = true;
}

export async function resume(): Promise<void> {
	if (!ctx || !playback.isPaused) return;
	await ctx.resume();
	// ctx.currentTime did not advance while suspended, so startContextTime is still valid
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
	if (source) {
		source.onended = null;
		try {
			source.stop();
		} catch {
			// already stopped
		}
		source.disconnect();
		source = null;
	}
	gainNode = null;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	playback.isPlaying = false;
	playback.isPaused = false;
	playback.currentFileId = null;
}
