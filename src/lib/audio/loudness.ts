// EBU R128 loudness measurement
// K-weighting applied via OfflineAudioContext IIR filters; LUFS via sliding window (O(N))

import type { BandResult } from '$lib/state/results.svelte';

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

// Channel gains per EBU R128 (L, R, C, Ls, Rs)
const CHANNEL_GAINS = [1, 1, 1, 1.41, 1.41];

export async function measureLoudness(buffer: AudioBuffer): Promise<Omit<BandResult, 'label'>> {
	const sr = buffer.sampleRate;
	const stepSamples = Math.round(0.1 * sr);
	const totalSteps = Math.floor(buffer.length / stepSamples);
	const momentaryChunks = 4;   // 400ms / 100ms
	const shortTermChunks = 30;  // 3000ms / 100ms
	const nCh = buffer.numberOfChannels;

	// Copy channel data BEFORE any OfflineAudioContext rendering, which may
	// detach the buffer's backing ArrayBuffers in some browsers.
	const rawChannels: Float32Array[] = [];
	for (let ch = 0; ch < nCh; ch++) {
		rawChannels.push(new Float32Array(buffer.getChannelData(ch)));
	}

	// Compute peak per 100ms step from raw data
	const peak: [number, number][] = [];
	for (let step = 0; step < totalSteps; step++) {
		const start = step * stepSamples;
		const end = Math.min(start + stepSamples, buffer.length);
		let p = 0;
		for (const data of rawChannels) {
			for (let i = start; i < end; i++) {
				const abs = Math.abs(data[i]);
				if (abs > p) p = abs;
			}
		}
		peak.push([step * 100, 20 * Math.log10(Math.max(p, 1e-10))]);
	}

	// Apply K-weighting
	const weighted = await applyKWeighting(buffer);

	// Precompute sum-of-squares per 100ms chunk per channel — O(N) pass
	const chunkSS: Float64Array[] = [];
	for (let ch = 0; ch < nCh; ch++) {
		const data = weighted.getChannelData(ch);
		const chunks = new Float64Array(totalSteps);
		for (let step = 0; step < totalSteps; step++) {
			const start = step * stepSamples;
			const end = Math.min(start + stepSamples, data.length);
			let ss = 0;
			for (let i = start; i < end; i++) ss += data[i] * data[i];
			chunks[step] = ss;
		}
		chunkSS.push(chunks);
	}

	// Sliding window LUFS — O(totalSteps × nCh), no inner sample loop
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

	return { momentary, shortTerm, peak };
}
