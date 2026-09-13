// Minimal radix-2 FFT. The Web Audio AnalyserNode is realtime-only and does not
// work inside an OfflineAudioContext, so offline spectra need their own.

type Tables = { rev: Uint32Array; cos: Float32Array; sin: Float32Array };

const tableCache = new Map<number, Tables>();

function tables(n: number): Tables {
	const hit = tableCache.get(n);
	if (hit) return hit;

	const bits = Math.log2(n);
	if (!Number.isInteger(bits)) throw new Error(`FFT size must be a power of two, got ${n}`);

	const rev = new Uint32Array(n);
	for (let i = 0; i < n; i++) {
		let r = 0;
		for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
		rev[i] = r;
	}

	const cos = new Float32Array(n / 2);
	const sin = new Float32Array(n / 2);
	for (let i = 0; i < n / 2; i++) {
		cos[i] = Math.cos((-2 * Math.PI * i) / n);
		sin[i] = Math.sin((-2 * Math.PI * i) / n);
	}

	const t = { rev, cos, sin };
	tableCache.set(n, t);
	return t;
}

/** In-place complex FFT. `re`/`im` must be the same power-of-two length. */
export function fft(re: Float32Array, im: Float32Array): void {
	const n = re.length;
	const { rev, cos, sin } = tables(n);

	for (let i = 0; i < n; i++) {
		const j = rev[i];
		if (j > i) {
			let t = re[i];
			re[i] = re[j];
			re[j] = t;
			t = im[i];
			im[i] = im[j];
			im[j] = t;
		}
	}

	for (let size = 2; size <= n; size <<= 1) {
		const half = size >> 1;
		const step = n / size;
		for (let start = 0; start < n; start += size) {
			for (let j = 0, k = 0; j < half; j++, k += step) {
				const l = start + j;
				const r = l + half;
				const wr = cos[k];
				const wi = sin[k];
				const xr = re[r] * wr - im[r] * wi;
				const xi = re[r] * wi + im[r] * wr;
				re[r] = re[l] - xr;
				im[r] = im[l] - xi;
				re[l] += xr;
				im[l] += xi;
			}
		}
	}
}

const windowCache = new Map<number, Float32Array>();

/** Periodic Hann window (coherent gain 0.5). */
export function hann(n: number): Float32Array {
	const hit = windowCache.get(n);
	if (hit) return hit;
	const w = new Float32Array(n);
	for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
	windowCache.set(n, w);
	return w;
}
