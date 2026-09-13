import { describe, it, expect } from 'vitest';
import {
	SpectrogramAccumulator,
	binFrequency,
	frequencyBin,
	byteDb,
	decodeBytes
} from './spectrogram';

const SAMPLE_RATE = 48000;

function sine(hz: number, seconds: number, amplitude = 1): Float32Array {
	const n = Math.round(seconds * SAMPLE_RATE);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
	return out;
}

/** Loudest stored bin of the first column. */
function peakBin(bytes: Uint8Array, bins: number): number {
	let best = 0;
	for (let b = 1; b < bins; b++) if (bytes[b] > bytes[best]) best = b;
	return best;
}

describe('SpectrogramAccumulator', () => {
	it('puts a sine in the bin for its frequency, at full scale', () => {
		const acc = new SpectrogramAccumulator(SAMPLE_RATE, 1);
		acc.feed([sine(1000, 1)]);
		const spec = acc.finish()!;

		expect(spec.maxFrequency).toBe(SAMPLE_RATE / 2);
		const bytes = decodeBytes(spec.data);
		const bin = peakBin(bytes, spec.bins);

		expect(binFrequency(spec, bin)).toBeCloseTo(1000, -2);
		// Full-scale sine reads as 0 dB (within the byte quantization step).
		expect(byteDb(bytes[bin])).toBeGreaterThan(-1);
	});

	it('reads back the frequency a bin index came from', () => {
		const acc = new SpectrogramAccumulator(SAMPLE_RATE, 0.2);
		acc.feed([sine(1000, 0.2)]);
		const spec = acc.finish()!;
		expect(frequencyBin(spec, binFrequency(spec, 42))).toBeCloseTo(42, 6);
	});

	it('shows nothing above a low-passed edge', () => {
		// Two tones: one well inside the band, one where a lossy codec would have
		// cut. Only the low one should light up.
		const acc = new SpectrogramAccumulator(SAMPLE_RATE, 1);
		acc.feed([sine(2000, 1)]);
		const spec = acc.finish()!;
		const bytes = decodeBytes(spec.data);

		const cutoffBin = Math.round(frequencyBin(spec, 16000));
		for (let b = cutoffBin; b < spec.bins; b++) {
			expect(byteDb(bytes[b])).toBeLessThan(-80);
		}
	});

	it('stays bounded on a long file and still spans it', () => {
		// 40 min of audio at 48 kHz would be 112k raw frames.
		const acc = new SpectrogramAccumulator(SAMPLE_RATE, 40 * 60);
		const block = sine(1000, 1);
		for (let s = 0; s < 40 * 60; s++) acc.feed([block]);
		const spec = acc.finish()!;

		expect(spec.columns).toBeGreaterThan(64);
		expect(spec.columns).toBeLessThanOrEqual(1024);
		expect(decodeBytes(spec.data).length).toBe(spec.columns * spec.bins);
	});

	it('is unaffected by how the input is chunked', () => {
		const whole = new SpectrogramAccumulator(SAMPLE_RATE, 1);
		whole.feed([sine(1000, 1)]);

		const chunked = new SpectrogramAccumulator(SAMPLE_RATE, 1);
		const signal = sine(1000, 1);
		for (let i = 0; i < signal.length; i += 777) {
			chunked.feed([signal.subarray(i, Math.min(signal.length, i + 777))]);
		}

		expect(chunked.finish()!.data).toBe(whole.finish()!.data);
	});
});
