import { describe, it, expect } from 'vitest';
import { LoudnessMeter } from './loudness';
import { buildBands, type FreqBand } from './filters';

const SR = 48000;

function sine(seconds: number, freq: number, amplitude: number): Float32Array {
	const out = new Float32Array(Math.round(seconds * SR));
	for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SR);
	return out;
}

function measure(channels: Float32Array[], band: FreqBand, chunkSizes: number[]) {
	const meter = new LoudnessMeter(SR, channels.length, band);
	let pos = 0;
	let i = 0;
	while (pos < channels[0].length) {
		const size = Math.min(chunkSizes[i++ % chunkSizes.length], channels[0].length - pos);
		meter.feed(channels.map((c) => c.subarray(pos, pos + size)));
		pos += size;
	}
	return meter.finish();
}

describe('LoudnessMeter', () => {
	const left = sine(10, 997, 0.1);
	const right = sine(10, 997, 0.1);
	const fullBand = buildBands([])[0];

	it('gives identical results regardless of chunk boundaries', () => {
		const whole = measure([left, right], fullBand, [left.length]);
		// Deliberately ragged: none of these divide the 4800-sample step evenly.
		const ragged = measure([left, right], fullBand, [1000, 4096, 333, 77777]);

		expect(ragged.integrated).toBe(whole.integrated);
		expect(ragged.peak).toEqual(whole.peak);
		expect(ragged.momentary).toEqual(whole.momentary);
		expect(ragged.shortTerm).toEqual(whole.shortTerm);
	});

	it('carries filter state across chunks for a band-limited measurement', () => {
		const band = buildBands([200, 2000]).find((b) => b.label === '200–2000 Hz')!;
		const whole = measure([left, right], band, [left.length]);
		const ragged = measure([left, right], band, [1000, 4096, 333]);

		expect(ragged.integrated).toBeCloseTo(whole.integrated, 9);
		for (let i = 0; i < whole.momentary.length; i++) {
			expect(ragged.momentary[i][1]).toBeCloseTo(whole.momentary[i][1], 9);
		}
	});

	it('measures a −20 dBFS 997 Hz stereo sine at the expected loudness', () => {
		const r = measure([left, right], fullBand, [left.length]);
		// 0.1 amplitude sine = −23 dBFS RMS per channel; summing two channels adds
		// 3 dB, K-weighting is ~flat at 1 kHz → ≈ −20 LUFS. Frozen expectation.
		expect(r.integrated).toBeCloseTo(-20.05, 1);
		expect(r.peak[0][1]).toBeCloseTo(-20, 1);
	});

	it('reports -Infinity when fed less than one 100 ms step', () => {
		const short = sine(0.05, 997, 0.1);
		const r = measure([short, short], fullBand, [short.length]);
		expect(r.integrated).toBe(-Infinity);
	});
});
