import { describe, it, expect } from 'vitest';
import { buildBandCoeffs, SLOPES, type FreqBand } from './filters';

// Playback feeds the *analysis* coefficients into IIRFilterNodes. This checks
// the claim that matters: an IIR chain built that way attenuates a tone exactly
// like the JS biquad chain the meter runs, at every slope — including LR12,
// whose 1st-order sections a BiquadFilterNode cannot express.

const SR = 48000;
const DURATION = 1;

function renderThroughIIR(band: FreqBand, slope: (typeof SLOPES)[number], freq: number) {
	const ctx = new OfflineAudioContext(1, SR * DURATION, SR);
	const osc = ctx.createOscillator();
	osc.frequency.value = freq;

	let last: AudioNode = osc;
	for (const c of buildBandCoeffs(band, SR, slope)) {
		const node = ctx.createIIRFilter([c.b0, c.b1, c.b2], [1, c.a1, c.a2]);
		last.connect(node);
		last = node;
	}
	last.connect(ctx.destination);
	osc.start();
	return ctx.startRendering();
}

function jsFilter(band: FreqBand, slope: (typeof SLOPES)[number], freq: number): Float64Array {
	let signal = new Float64Array(SR * DURATION);
	for (let i = 0; i < signal.length; i++) signal[i] = Math.sin((2 * Math.PI * freq * i) / SR);
	for (const c of buildBandCoeffs(band, SR, slope)) {
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

/** RMS of the settled second half, in dB. */
function tailDb(samples: Float32Array | Float64Array): number {
	const from = Math.floor(samples.length / 2);
	let sum = 0;
	for (let i = from; i < samples.length; i++) sum += samples[i] * samples[i];
	return 20 * Math.log10(Math.sqrt(sum / (samples.length - from)));
}

const lowBand: FreqBand = { label: '0–200 Hz', lowHz: null, highHz: 200 };
const midBand: FreqBand = { label: '200–2000 Hz', lowHz: 200, highHz: 2000 };

describe('playback filtering matches analysis', () => {
	for (const slope of SLOPES) {
		// One octave above the 200 Hz cutoff: deep enough to prove the filter
		// works (-12 to -48 dB), shallow enough to stay well clear of the float32
		// render floor. A decade out, an 8th-order cascade lands near -150 dB,
		// where float32 rounding alone accounts for a 12 dB spread.
		it(`${slope}: an out-of-band tone is attenuated identically`, async () => {
			const rendered = await renderThroughIIR(lowBand, slope, 400);
			const expected = jsFilter(lowBand, slope, 400);
			const renderedDb = tailDb(rendered.getChannelData(0));
			expect(renderedDb).toBeCloseTo(tailDb(expected), 1);
			expect(renderedDb).toBeLessThan(-10);
		});
	}

	it('passes an in-band tone through essentially untouched', async () => {
		const rendered = await renderThroughIIR(midBand, 'LR24', 700);
		expect(tailDb(rendered.getChannelData(0))).toBeCloseTo(-3, 0); // sine RMS ≈ -3 dB
	});

	it('the full band inserts no filters at all', async () => {
		const full: FreqBand = { label: 'full', lowHz: null, highHz: null };
		expect(buildBandCoeffs(full, SR, 'LR24')).toEqual([]);
		const rendered = await renderThroughIIR(full, 'LR24', 700);
		expect(tailDb(rendered.getChannelData(0))).toBeCloseTo(-3, 1);
	});
});
