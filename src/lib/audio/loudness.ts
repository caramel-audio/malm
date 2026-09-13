// EBU R128 loudness measurement via streaming JS biquad filtering.
// No OfflineAudioContext or full-file buffer copies — processes source samples directly.

import type { BandResult } from '$lib/state/results.svelte';
import { type FreqBand, type BiquadCoeffs, type Slope, buildBandCoeffs } from './filters';

// K-weighting filter coefficients (pre-filter + RLB weighting per EBU R128)
function kWeightingCoeffs(fs: number): BiquadCoeffs[] {
	// Pre-filter: high-shelf via bilinear transform
	const db = 3.999843853973347,
		f0 = 1681.974450955533,
		Qpre = 0.7071752369554196;
	const K = Math.tan((Math.PI * f0) / fs);
	const Vh = Math.pow(10, db / 20),
		Vb = Math.pow(Vh, 0.4996667741545416);
	const d0 = 1 + K / Qpre + K * K;
	const pre: BiquadCoeffs = {
		b0: (Vh + (Vb * K) / Qpre + K * K) / d0,
		b1: (2 * (K * K - Vh)) / d0,
		b2: (Vh - (Vb * K) / Qpre + K * K) / d0,
		a1: (2 * (K * K - 1)) / d0,
		a2: (1 - K / Qpre + K * K) / d0
	};

	// Weighting filter: highpass
	const f1 = 38.13547087602444,
		Qw = 0.5003270373238773;
	const Kw = Math.tan((Math.PI * f1) / fs);
	const dw = 1 + Kw / Qw + Kw * Kw;
	const weight: BiquadCoeffs = {
		b0: 1 / dw,
		b1: -2 / dw,
		b2: 1 / dw,
		a1: (2 * (Kw * Kw - 1)) / dw,
		a2: (1 - Kw / Qw + Kw * Kw) / dw
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

function toDb(meanSquare: number): number {
	return -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-10));
}

// Absolute gate at -70 LUFS, as a mean square
const ABS_GATE_MS = Math.pow(10, (-70 + 0.691) / 10);

/**
 * EBU R128 gating (absolute gate at -70 LUFS, relative gate 10 dB below the
 * ungated mean) over 400 ms blocks. Gating decisions are made on the
 * channel-summed level; what comes back is the surviving mean square *per
 * channel*, so the integrated loudness and the L/R difference are both read off
 * exactly the same set of blocks. Null when everything was gated out.
 */
function gatedChannelMeans(chunkSS: Float64Array[], stepSamples: number): Float64Array | null {
	const totalSteps = chunkSS[0].length;
	const nCh = chunkSS.length;
	const blockChunks = 4; // 400 ms blocks at 100 ms steps
	const nBlocks = totalSteps - blockChunks + 1;
	if (nBlocks <= 0) return null;

	const blockSum = new Float64Array(nBlocks); // channel-weighted, drives the gate
	const blockCh = new Float64Array(nBlocks * nCh); // per channel, drives the balance
	const running = new Float64Array(nCh);
	for (let step = 0; step < totalSteps; step++) {
		for (let ch = 0; ch < nCh; ch++) {
			running[ch] += chunkSS[ch][step];
			if (step >= blockChunks) running[ch] -= chunkSS[ch][step - blockChunks];
		}
		if (step >= blockChunks - 1) {
			const b = step - blockChunks + 1;
			let sum = 0;
			for (let ch = 0; ch < nCh; ch++) {
				const ms = running[ch] / (blockChunks * stepSamples);
				blockCh[b * nCh + ch] = ms;
				sum += (CHANNEL_GAINS[ch] ?? 1) * ms;
			}
			blockSum[b] = sum;
		}
	}

	let count = 0,
		total = 0;
	for (let b = 0; b < nBlocks; b++) {
		if (blockSum[b] >= ABS_GATE_MS) {
			count++;
			total += blockSum[b];
		}
	}
	if (count === 0) return null;

	const relThreshold = (total / count) * Math.pow(10, -10 / 10);
	const means = new Float64Array(nCh);
	let kept = 0;
	for (let b = 0; b < nBlocks; b++) {
		if (blockSum[b] < ABS_GATE_MS || blockSum[b] < relThreshold) continue;
		kept++;
		for (let ch = 0; ch < nCh; ch++) means[ch] += blockCh[b * nCh + ch];
	}
	if (kept === 0) return null;
	for (let ch = 0; ch < nCh; ch++) means[ch] /= kept;
	return means;
}

/** dB by which left exceeds right, from two mean squares. Null if either is silent. */
function balanceDb(l: number, r: number): number | null {
	return l > 0 && r > 0 ? 10 * Math.log10(l / r) : null;
}

/**
 * Push-based EBU R128 meter. Feed arbitrary-length PCM chunks; filter state and
 * the partially filled 100 ms step carry across `feed()` calls, so chunking has
 * no effect on the result.
 */
export class LoudnessMeter {
	private readonly stepSamples: number;
	private readonly bandCoeffs: BiquadCoeffs[];
	private readonly kCoeffs: BiquadCoeffs[];
	private readonly bandStates: Float64Array[][];
	private readonly kStates: Float64Array[][];

	// Completed 100 ms steps: K-weighted sum-of-squares per channel, band peak per step
	private readonly stepSS: number[][];
	private readonly peak: [number, number][] = [];

	// Accumulators for the step currently being filled
	private readonly accSS: Float64Array;
	private accPeak = 0;
	private samplesIntoStep = 0;

	constructor(
		sampleRate: number,
		private readonly nCh: number,
		band: FreqBand,
		slope: Slope = 'LR24'
	) {
		this.stepSamples = Math.round(0.1 * sampleRate);
		this.bandCoeffs = buildBandCoeffs(band, sampleRate, slope);
		this.kCoeffs = kWeightingCoeffs(sampleRate);
		this.bandStates = Array.from({ length: nCh }, () =>
			this.bandCoeffs.map(() => new Float64Array(2))
		);
		this.kStates = Array.from({ length: nCh }, () => this.kCoeffs.map(() => new Float64Array(2)));
		this.stepSS = Array.from({ length: nCh }, () => []);
		this.accSS = new Float64Array(nCh);
	}

	feed(channels: Float32Array[]): void {
		const { nCh, bandCoeffs, kCoeffs, bandStates, kStates, accSS, stepSamples } = this;
		const n = channels[0]?.length ?? 0;

		for (let i = 0; i < n; i++) {
			for (let ch = 0; ch < nCh; ch++) {
				const bs = bandStates[ch];
				const ks = kStates[ch];
				let y = channels[ch][i];
				for (let s = 0; s < bandCoeffs.length; s++) y = processSample(y, bandCoeffs[s], bs[s]);
				const abs = Math.abs(y);
				if (abs > this.accPeak) this.accPeak = abs;
				for (let s = 0; s < kCoeffs.length; s++) y = processSample(y, kCoeffs[s], ks[s]);
				accSS[ch] += y * y;
			}

			if (++this.samplesIntoStep === stepSamples) {
				const step = this.peak.length;
				for (let ch = 0; ch < nCh; ch++) {
					this.stepSS[ch].push(accSS[ch]);
					accSS[ch] = 0;
				}
				this.peak.push([step * 100, 20 * Math.log10(Math.max(this.accPeak, 1e-10))]);
				this.accPeak = 0;
				this.samplesIntoStep = 0;
			}
		}
	}

	/** Trailing partial step is discarded, matching the original whole-buffer pass. */
	finish(): Omit<BandResult, 'label'> {
		const { nCh, stepSamples } = this;
		const chunkSS = this.stepSS.map((ss) => Float64Array.from(ss));
		const totalSteps = chunkSS[0]?.length ?? 0;

		// Sliding-window momentary (400 ms) and short-term (3 s) LUFS
		const momentaryChunks = 4,
			shortTermChunks = 30;
		const mRunning = new Float64Array(nCh);
		const stRunning = new Float64Array(nCh);
		const momentary: [number, number][] = [];
		const shortTerm: [number, number][] = [];
		// L/R difference over the short-term window — 400 ms is too jittery to read
		// a fraction of a dB off. Only meaningful for stereo.
		const balance: [number, number][] = [];
		const stereo = nCh >= 2;

		for (let step = 0; step < totalSteps; step++) {
			for (let ch = 0; ch < nCh; ch++) {
				mRunning[ch] += chunkSS[ch][step];
				if (step >= momentaryChunks) mRunning[ch] -= chunkSS[ch][step - momentaryChunks];
				stRunning[ch] += chunkSS[ch][step];
				if (step >= shortTermChunks) stRunning[ch] -= chunkSS[ch][step - shortTermChunks];
			}

			const mChunks = Math.min(step + 1, momentaryChunks);
			const stChunks = Math.min(step + 1, shortTermChunks);
			let mSum = 0,
				stSum = 0;
			for (let ch = 0; ch < nCh; ch++) {
				const gain = CHANNEL_GAINS[ch] ?? 1;
				mSum += gain * (mRunning[ch] / (mChunks * stepSamples));
				stSum += gain * (stRunning[ch] / (stChunks * stepSamples));
			}

			momentary.push([step * 100, toDb(mSum)]);
			shortTerm.push([step * 100, toDb(stSum)]);

			// Below the absolute gate the ratio is noise dividing noise — leave a gap
			// rather than draw a spike.
			if (stereo && stSum >= ABS_GATE_MS) {
				const denom = stChunks * stepSamples;
				const db = balanceDb(stRunning[0] / denom, stRunning[1] / denom);
				if (db !== null) balance.push([step * 100, db]);
			}
		}

		const means = totalSteps > 0 ? gatedChannelMeans(chunkSS, stepSamples) : null;
		let integrated = -Infinity;
		if (means) {
			let sum = 0;
			for (let ch = 0; ch < nCh; ch++) sum += (CHANNEL_GAINS[ch] ?? 1) * means[ch];
			integrated = toDb(sum);
		}

		return {
			momentary,
			shortTerm,
			peak: this.peak,
			integrated,
			...(stereo
				? {
						balance,
						balanceIntegrated: (means && balanceDb(means[0], means[1])) ?? undefined
					}
				: {})
		};
	}
}

/**
 * Min/max of the raw (unfiltered) signal per 100 ms step, across all channels —
 * the stored "peak file" the plot draws instead of re-reading PCM.
 */
export class WaveformAccumulator {
	private readonly stepSamples: number;
	private readonly points: [number, number][] = [];
	private min = 0;
	private max = 0;
	private samplesIntoStep = 0;

	constructor(sampleRate: number) {
		this.stepSamples = Math.round(0.1 * sampleRate);
	}

	feed(channels: Float32Array[]): void {
		const nCh = channels.length;
		const n = channels[0]?.length ?? 0;
		for (let i = 0; i < n; i++) {
			for (let ch = 0; ch < nCh; ch++) {
				const v = channels[ch][i];
				if (v < this.min) this.min = v;
				if (v > this.max) this.max = v;
			}
			if (++this.samplesIntoStep === this.stepSamples) {
				this.points.push([this.min, this.max]);
				this.min = 0;
				this.max = 0;
				this.samplesIntoStep = 0;
			}
		}
	}

	finish(): [number, number][] {
		if (this.samplesIntoStep > 0) this.points.push([this.min, this.max]);
		return this.points;
	}
}
