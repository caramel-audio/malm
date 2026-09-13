// Streaming STFT for the spectrogram tab. Like `WaveformAccumulator`, this is
// fed the same decoded chunks the loudness meters see, so it costs no extra
// decode pass — and like the waveform it stores a fixed-size summary rather than
// one column per hop, which would be gigabytes on a multi-hour track.

import { fft, hann } from './fft';

const FRAME = 2048;
/** Stored bins: adjacent FFT bin pairs are merged, so FRAME/2 / 2. */
const BINS = 512;
const MAX_COLUMNS = 1024;
/** Anything below this reads as silence and clamps to byte 0. */
const DB_FLOOR = -120;

export type Spectrogram = {
	columns: number;
	bins: number;
	sampleRate: number;
	/** Frequency at the top of the stored range (Nyquist), in Hz. */
	maxFrequency: number;
	/** base64 of a `columns * bins` Uint8Array, column-major, bin 0 = DC. */
	data: string;
};

/** Centre frequency of a stored bin, in Hz. */
export function binFrequency(spec: Spectrogram, bin: number): number {
	return ((bin + 0.5) * spec.maxFrequency) / spec.bins;
}

/** Fractional bin index a frequency falls in — inverse of `binFrequency`. */
export function frequencyBin(spec: Spectrogram, hz: number): number {
	return (hz / spec.maxFrequency) * spec.bins - 0.5;
}

/** dB the stored byte stands for. */
export function byteDb(byte: number): number {
	return (byte * -DB_FLOOR) / 255 + DB_FLOOR;
}

export function encodeBytes(bytes: Uint8Array): string {
	let s = '';
	// String.fromCharCode is applied in slices — spreading 500k arguments blows
	// the call stack.
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(s);
}

export function decodeBytes(base64: string): Uint8Array {
	const bin = atob(base64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export class SpectrogramAccumulator {
	private readonly sampleRate: number;
	private readonly hop: number;
	private readonly buf = new Float32Array(FRAME);
	private readonly re = new Float32Array(FRAME);
	private readonly im = new Float32Array(FRAME);
	private readonly window = hann(FRAME);
	private readonly data = new Uint8Array(MAX_COLUMNS * BINS);

	private pos = 0;
	private nextFrameStart = 0;
	private fill = 0;
	private column = 0;
	private framesPerColumn = 1;
	private framesInColumn = 0;

	/**
	 * `durationSeconds` only sets the hop: frames are sampled sparsely so a long
	 * track costs a bounded number of FFTs instead of one per 2048 samples. A
	 * wrong duration is harmless — the column merge below still bounds memory.
	 */
	constructor(sampleRate: number, durationSeconds: number) {
		this.sampleRate = sampleRate;
		const total = Math.max(0, durationSeconds) * sampleRate;
		// ponytail: ~4 frames per stored column. Raise if the picture looks
		// under-sampled on short, busy material.
		this.hop = Math.max(FRAME, Math.floor(total / (MAX_COLUMNS * 4)) || FRAME);
	}

	feed(channels: Float32Array[]): void {
		const nCh = channels.length;
		const n = channels[0]?.length ?? 0;
		let i = 0;

		while (i < n) {
			// Between frames: skip in bulk rather than per sample.
			if (this.pos < this.nextFrameStart) {
				const skip = Math.min(n - i, this.nextFrameStart - this.pos);
				i += skip;
				this.pos += skip;
				continue;
			}

			const take = Math.min(n - i, FRAME - this.fill);
			for (let k = 0; k < take; k++) {
				let sum = 0;
				for (let ch = 0; ch < nCh; ch++) sum += channels[ch][i + k];
				this.buf[this.fill + k] = sum / nCh;
			}
			this.fill += take;
			i += take;
			this.pos += take;

			if (this.fill === FRAME) {
				this.transform();
				this.fill = 0;
				this.nextFrameStart += this.hop;
			}
		}
	}

	private transform(): void {
		const { re, im, buf, window } = this;
		for (let k = 0; k < FRAME; k++) {
			re[k] = buf[k] * window[k];
			im[k] = 0;
		}
		fft(re, im);

		// Scaled so a full-scale sine peaks at 0 dB (Hann coherent gain 0.5).
		const scale = 4 / FRAME;
		const base = this.column * BINS;
		for (let b = 0; b < BINS; b++) {
			// Merge the two raw bins this one covers, keeping the louder — a codec
			// shelf is a thin edge and averaging would smear it away.
			let mag = 0;
			for (let r = b * 2; r < b * 2 + 2; r++) {
				const m = Math.sqrt(re[r] * re[r] + im[r] * im[r]);
				if (m > mag) mag = m;
			}
			const db = mag > 0 ? 20 * Math.log10(mag * scale) : DB_FLOOR;
			const byte =
				db <= DB_FLOOR ? 0 : Math.min(255, Math.round(((db - DB_FLOOR) * 255) / -DB_FLOOR));
			if (byte > this.data[base + b]) this.data[base + b] = byte;
		}

		if (++this.framesInColumn === this.framesPerColumn) {
			this.framesInColumn = 0;
			if (++this.column === MAX_COLUMNS) this.halve();
		}
	}

	/** Fold column pairs together so the track can run on without growing. */
	private halve(): void {
		const half = MAX_COLUMNS / 2;
		for (let c = 0; c < half; c++) {
			const dst = c * BINS;
			const a = c * 2 * BINS;
			const b = a + BINS;
			for (let k = 0; k < BINS; k++) {
				const v = this.data[a + k] > this.data[b + k] ? this.data[a + k] : this.data[b + k];
				this.data[dst + k] = v;
			}
		}
		this.data.fill(0, half * BINS);
		this.column = half;
		this.framesPerColumn *= 2;
	}

	finish(): Spectrogram | null {
		// A partly filled trailing column is still worth keeping — otherwise short
		// files come out empty.
		const columns = this.column + (this.framesInColumn > 0 ? 1 : 0);
		if (columns === 0) return null;
		return {
			columns,
			bins: BINS,
			sampleRate: this.sampleRate,
			maxFrequency: this.sampleRate / 2,
			data: encodeBytes(this.data.subarray(0, columns * BINS))
		};
	}
}
