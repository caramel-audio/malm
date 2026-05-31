// EBU R128 loudness measurement via streaming JS biquad filtering.
// No OfflineAudioContext or full-file buffer copies — processes source samples directly.

import type { BandResult } from '$lib/state/results.svelte';
import { type FreqBand, type BiquadCoeffs, buildBandCoeffs } from './filters';

// K-weighting filter coefficients (pre-filter + RLB weighting per EBU R128)
function kWeightingCoeffs(fs: number): BiquadCoeffs[] {
	// Pre-filter: high-shelf via bilinear transform
	const db = 3.999843853973347, f0 = 1681.974450955533, Qpre = 0.7071752369554196;
	const K = Math.tan(Math.PI * f0 / fs);
	const Vh = Math.pow(10, db / 20), Vb = Math.pow(Vh, 0.4996667741545416);
	const d0 = 1 + K / Qpre + K * K;
	const pre: BiquadCoeffs = {
		b0: (Vh + Vb * K / Qpre + K * K) / d0,
		b1: 2 * (K * K - Vh) / d0,
		b2: (Vh - Vb * K / Qpre + K * K) / d0,
		a1: 2 * (K * K - 1) / d0,
		a2: (1 - K / Qpre + K * K) / d0,
	};

	// Weighting filter: highpass
	const f1 = 38.13547087602444, Qw = 0.5003270373238773;
	const Kw = Math.tan(Math.PI * f1 / fs);
	const dw = 1 + Kw / Qw + Kw * Kw;
	const weight: BiquadCoeffs = {
		b0: 1 / dw, b1: -2 / dw, b2: 1 / dw,
		a1: 2 * (Kw * Kw - 1) / dw,
		a2: (1 - Kw / Qw + Kw * Kw) / dw,
	};

	return [pre, weight];
}

// Direct Form II Transposed biquad — processes one sample, mutates state in place
function processSample(x: number, c: BiquadCoeffs, s: Float64Array): number {
	const y = c.b0 * x + s[0];
	s[0] = c.b1 * x - c.a1 * y + s[1];
	s[1] = c.b2 * x - c.a2 * y;
	return y;
}

// Channel weights per EBU R128 (L, R, C, Ls, Rs)
const CHANNEL_GAINS = [1, 1, 1, 1.41, 1.41];

// EBU R128 gating: absolute gate at -70 LUFS, relative gate 10 dB below ungated mean
function integratedLufs(chunkSS: Float64Array[], stepSamples: number): number {
	const totalSteps = chunkSS[0].length;
	const nCh = chunkSS.length;
	const blockChunks = 4; // 400 ms blocks at 100 ms steps

	const blockMS: number[] = [];
	const running = new Float64Array(nCh);
	for (let step = 0; step < totalSteps; step++) {
		for (let ch = 0; ch < nCh; ch++) {
			running[ch] += chunkSS[ch][step];
			if (step >= blockChunks) running[ch] -= chunkSS[ch][step - blockChunks];
		}
		if (step >= blockChunks - 1) {
			let sum = 0;
			for (let ch = 0; ch < nCh; ch++) sum += (CHANNEL_GAINS[ch] ?? 1) * running[ch];
			blockMS.push(sum / (blockChunks * stepSamples));
		}
	}

	const absThreshold = Math.pow(10, (-70 + 0.691) / 10);
	const gated1 = blockMS.filter((ms) => ms >= absThreshold);
	if (gated1.length === 0) return -Infinity;

	const ungatedMean = gated1.reduce((a, b) => a + b, 0) / gated1.length;
	const relThreshold = ungatedMean * Math.pow(10, -10 / 10);
	const gated2 = gated1.filter((ms) => ms >= relThreshold);
	if (gated2.length === 0) return -Infinity;

	return -0.691 + 10 * Math.log10(gated2.reduce((a, b) => a + b, 0) / gated2.length);
}

export async function measureLoudness(buffer: AudioBuffer, band: FreqBand): Promise<Omit<BandResult, 'label'>> {
	const sr = buffer.sampleRate;
	const stepSamples = Math.round(0.1 * sr); // 100 ms chunks
	const totalSteps = Math.floor(buffer.length / stepSamples);
	const nCh = buffer.numberOfChannels;

	const bandCoeffs = buildBandCoeffs(band, sr);
	const kCoeffs = kWeightingCoeffs(sr);

	// Per-channel filter states: [channel][stage] -> Float64Array([s0, s1])
	const bandStates = Array.from({ length: nCh }, () => bandCoeffs.map(() => new Float64Array(2)));
	const kStates = Array.from({ length: nCh }, () => kCoeffs.map(() => new Float64Array(2)));

	const channels = Array.from({ length: nCh }, (_, ch) => buffer.getChannelData(ch));

	// K-weighted sum-of-squares per 100 ms chunk per channel
	const chunkSS: Float64Array[] = Array.from({ length: nCh }, () => new Float64Array(totalSteps));
	const peak: [number, number][] = [];

	// Single streaming pass: band-filter → peak, then K-weight → SS
	for (let step = 0; step < totalSteps; step++) {
		const start = step * stepSamples;
		const end = Math.min(start + stepSamples, buffer.length);
		let p = 0;

		for (let ch = 0; ch < nCh; ch++) {
			const src = channels[ch];
			const bs = bandStates[ch];
			const ks = kStates[ch];
			let ss = 0;

			for (let i = start; i < end; i++) {
				let y = src[i];
				for (let s = 0; s < bandCoeffs.length; s++) y = processSample(y, bandCoeffs[s], bs[s]);
				const abs = Math.abs(y);
				if (abs > p) p = abs;
				for (let s = 0; s < kCoeffs.length; s++) y = processSample(y, kCoeffs[s], ks[s]);
				ss += y * y;
			}

			chunkSS[ch][step] = ss;
		}

		peak.push([step * 100, 20 * Math.log10(Math.max(p, 1e-10))]);

		// Yield to the event loop every 30 chunks (~3 s) to keep UI responsive
		if (step % 30 === 29) await new Promise((r) => setTimeout(r, 0));
	}

	// Sliding-window momentary (400 ms) and short-term (3 s) LUFS
	const momentaryChunks = 4, shortTermChunks = 30;
	const mRunning = new Float64Array(nCh);
	const stRunning = new Float64Array(nCh);
	const momentary: [number, number][] = [];
	const shortTerm: [number, number][] = [];

	for (let step = 0; step < totalSteps; step++) {
		for (let ch = 0; ch < nCh; ch++) {
			mRunning[ch] += chunkSS[ch][step];
			if (step >= momentaryChunks) mRunning[ch] -= chunkSS[ch][step - momentaryChunks];
			stRunning[ch] += chunkSS[ch][step];
			if (step >= shortTermChunks) stRunning[ch] -= chunkSS[ch][step - shortTermChunks];
		}

		const mChunks = Math.min(step + 1, momentaryChunks);
		const stChunks = Math.min(step + 1, shortTermChunks);
		let mSum = 0, stSum = 0;
		for (let ch = 0; ch < nCh; ch++) {
			const gain = CHANNEL_GAINS[ch] ?? 1;
			mSum += gain * (mRunning[ch] / (mChunks * stepSamples));
			stSum += gain * (stRunning[ch] / (stChunks * stepSamples));
		}

		momentary.push([step * 100, -0.691 + 10 * Math.log10(Math.max(mSum, 1e-10))]);
		shortTerm.push([step * 100, -0.691 + 10 * Math.log10(Math.max(stSum, 1e-10))]);
	}

	const integrated = integratedLufs(chunkSS, stepSamples);

	return { momentary, shortTerm, peak, integrated };
}
