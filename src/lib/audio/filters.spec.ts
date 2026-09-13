import { describe, it, expect } from 'vitest';
import { buildBandCoeffs, SLOPES, type BiquadCoeffs, type FreqBand } from './filters';

const SR = 48000;

function applyStages(input: Float64Array, stages: BiquadCoeffs[]): Float64Array {
	let signal = input;
	for (const c of stages) {
		const out = new Float64Array(signal.length);
		const s = new Float64Array(2);
		for (let i = 0; i < signal.length; i++) {
			const x = signal[i];
			const y = c.b0 * x + s[0];
			s[0] = c.b1 * x - c.a1 * y + s[1];
			s[1] = c.b2 * x - c.a2 * y;
			out[i] = y;
		}
		signal = out;
	}
	return signal;
}

/** dB attenuation a band applies to a steady sine, measured on the settled tail. */
function attenuationDb(band: FreqBand, slope: (typeof SLOPES)[number], freq: number): number {
	const n = SR * 2;
	const input = new Float64Array(n);
	for (let i = 0; i < n; i++) input[i] = Math.sin((2 * Math.PI * freq * i) / SR);
	const out = applyStages(input, buildBandCoeffs(band, SR, slope));
	const rms = (a: Float64Array) => {
		let sum = 0;
		for (let i = SR; i < a.length; i++) sum += a[i] * a[i];
		return Math.sqrt(sum / (a.length - SR));
	};
	return 20 * Math.log10(rms(out) / rms(input));
}

const highpass: FreqBand = { label: 'hp', lowHz: 1000, highHz: null };

describe('buildBandCoeffs', () => {
	it('LR24 is unchanged: two identical Q=1/√2 biquads per cutoff', () => {
		const stages = buildBandCoeffs(highpass, SR, 'LR24');
		expect(stages).toHaveLength(2);
		expect(stages[0]).toEqual(stages[1]);
		// Frozen against the previous hardcoded implementation.
		const Q = Math.SQRT1_2;
		const K = Math.tan((Math.PI * 1000) / SR);
		const norm = 1 / (1 + K / Q + K * K);
		expect(stages[0].b0).toBeCloseTo(norm, 12);
		expect(stages[0].b1).toBeCloseTo(-2 * norm, 12);
	});

	it('defaults to LR24 when no slope is given', () => {
		expect(buildBandCoeffs(highpass, SR)).toEqual(buildBandCoeffs(highpass, SR, 'LR24'));
	});

	it('LR12 uses two first-order sections (b2 and a2 are zero)', () => {
		const stages = buildBandCoeffs(highpass, SR, 'LR12');
		expect(stages).toHaveLength(2);
		for (const s of stages) {
			expect(s.b2).toBe(0);
			expect(s.a2).toBe(0);
		}
	});

	it('uses one stage per biquad section, doubled for Linkwitz-Riley', () => {
		const count = (slope: (typeof SLOPES)[number]) => buildBandCoeffs(highpass, SR, slope).length;
		expect(count('BW12')).toBe(1);
		expect(count('BW24')).toBe(2);
		expect(count('BW48')).toBe(4);
		expect(count('LR12')).toBe(2);
		expect(count('LR24')).toBe(2);
		expect(count('LR48')).toBe(4);
	});

	it('the full band applies no filtering at any slope', () => {
		for (const slope of SLOPES) {
			expect(buildBandCoeffs({ label: 'full', lowHz: null, highHz: null }, SR, slope)).toEqual([]);
		}
	});

	it('steeper slopes attenuate an out-of-band tone more', () => {
		const bw12 = attenuationDb(highpass, 'BW12', 100);
		const bw24 = attenuationDb(highpass, 'BW24', 100);
		const bw48 = attenuationDb(highpass, 'BW48', 100);
		expect(bw12).toBeGreaterThan(bw24);
		expect(bw24).toBeGreaterThan(bw48);
		// 100 Hz is 3.32 octaves below the 1 kHz cutoff → ≈ slope × 3.32 dB down.
		expect(bw12).toBeCloseTo(-40, 0);
		expect(bw24).toBeCloseTo(-80, 0);
	});

	it('a Linkwitz-Riley slope is exactly its Butterworth half applied twice', () => {
		expect(attenuationDb(highpass, 'LR24', 100)).toBeCloseTo(
			2 * attenuationDb(highpass, 'BW12', 100),
			6
		);
		expect(attenuationDb(highpass, 'LR48', 100)).toBeCloseTo(
			2 * attenuationDb(highpass, 'BW24', 100),
			6
		);
	});

	it('every slope is −6 dB at the Linkwitz-Riley crossover, −3 dB at the Butterworth one', () => {
		expect(attenuationDb(highpass, 'LR12', 1000)).toBeCloseTo(-6, 1);
		expect(attenuationDb(highpass, 'LR24', 1000)).toBeCloseTo(-6, 1);
		expect(attenuationDb(highpass, 'LR48', 1000)).toBeCloseTo(-6, 1);
		expect(attenuationDb(highpass, 'BW12', 1000)).toBeCloseTo(-3, 1);
		expect(attenuationDb(highpass, 'BW24', 1000)).toBeCloseTo(-3, 1);
		expect(attenuationDb(highpass, 'BW48', 1000)).toBeCloseTo(-3, 1);
	});
});
