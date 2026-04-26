// EBU R128 loudness measurement
// K-weighting applied via OfflineAudioContext IIR filters; windows computed manually

import type { BandResult } from '$lib/state/results.svelte';

// EBU R128 K-weighting filter coefficients (from ITU-R BS.1770)
function preFilterCoefficients(fs: number) {
	const db = 3.999843853973347;
	const f0 = 1681.974450955533;
	const Q = 0.7071752369554196;
	const K = Math.tan(Math.PI * f0 / fs);
	const Vh = Math.pow(10, db / 20);
	const Vb = Math.pow(Vh, 0.4996667741545416);
	const d0 = 1 + K / Q + K * K;
	return {
		numerators: [(Vh + Vb * K / Q + K * K) / d0, 2 * (K * K - Vh) / d0, (Vh - Vb * K / Q + K * K) / d0],
		denominators: [1, 2 * (K * K - 1) / d0, (1 - K / Q + K * K) / d0],
	};
}

function weightingFilterCoefficients(fs: number) {
	const f0 = 38.13547087602444;
	const Q = 0.5003270373238773;
	const K = Math.tan(Math.PI * f0 / fs);
	const d0 = 1 + K / Q + K * K;
	return {
		numerators: [1, -2, 1],
		denominators: [1, 2 * (K * K - 1) / d0, (1 - K / Q + K * K) / d0],
	};
}

async function applyKWeighting(buffer: AudioBuffer): Promise<AudioBuffer> {
	const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	const preCoeffs = preFilterCoefficients(buffer.sampleRate);
	const weightCoeffs = weightingFilterCoefficients(buffer.sampleRate);
	const pre = ctx.createIIRFilter(preCoeffs.numerators, preCoeffs.denominators);
	const weight = ctx.createIIRFilter(weightCoeffs.numerators, weightCoeffs.denominators);
	src.connect(pre);
	pre.connect(weight);
	weight.connect(ctx.destination);
	src.start(0);
	return ctx.startRendering();
}

// Channel gains per EBU R128 (L, R, C, Ls, Rs); beyond 5ch treated as 1.0
const CHANNEL_GAINS = [1, 1, 1, 1.41, 1.41];

function computeLUFS(weighted: AudioBuffer, startSample: number, blockSamples: number): number {
	let sum = 0;
	for (let ch = 0; ch < weighted.numberOfChannels; ch++) {
		const data = weighted.getChannelData(ch);
		const gain = CHANNEL_GAINS[ch] ?? 1;
		let ms = 0;
		const end = Math.min(startSample + blockSamples, data.length);
		for (let i = startSample; i < end; i++) ms += data[i] * data[i];
		sum += gain * (ms / blockSamples);
	}
	return -0.691 + 10 * Math.log10(Math.max(sum, 1e-10));
}

function computePeakDbfs(buffer: AudioBuffer, startSample: number, windowSamples: number): number {
	let peak = 0;
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const data = buffer.getChannelData(ch);
		const end = Math.min(startSample + windowSamples, data.length);
		for (let i = startSample; i < end; i++) {
			const abs = Math.abs(data[i]);
			if (abs > peak) peak = abs;
		}
	}
	return 20 * Math.log10(Math.max(peak, 1e-10));
}

export async function measureLoudness(buffer: AudioBuffer): Promise<Omit<BandResult, 'label'>> {
	const sr = buffer.sampleRate;
	const stepSamples = Math.round(0.1 * sr);
	const momentarySamples = Math.round(0.4 * sr);
	const shortTermSamples = Math.round(3.0 * sr);
	const totalSteps = Math.floor(buffer.length / stepSamples);

	// Copy channel data into plain arrays BEFORE any OfflineAudioContext rendering,
	// which may detach the buffer's backing ArrayBuffers in some browsers.
	const channelData: Float32Array[] = [];
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		channelData.push(new Float32Array(buffer.getChannelData(ch)));
	}

	// Compute peak from copied raw data
	const peak: [number, number][] = [];
	for (let step = 0; step < totalSteps; step++) {
		const start = step * stepSamples;
		const end = Math.min(start + stepSamples, buffer.length);
		let p = 0;
		for (const data of channelData) {
			for (let i = start; i < end; i++) {
				const abs = Math.abs(data[i]);
				if (abs > p) p = abs;
			}
		}
		peak.push([step * 100, 20 * Math.log10(Math.max(p, 1e-10))]);
	}

	// Apply K-weighting and compute LUFS
	const weighted = await applyKWeighting(buffer);
	const momentary: [number, number][] = [];
	const shortTerm: [number, number][] = [];

	for (let step = 0; step < totalSteps; step++) {
		const startSample = step * stepSamples;
		const timeMs = step * 100;
		momentary.push([timeMs, computeLUFS(weighted, startSample, momentarySamples)]);
		shortTerm.push([timeMs, computeLUFS(weighted, startSample, shortTermSamples)]);
	}

	return { momentary, shortTerm, peak };
}
