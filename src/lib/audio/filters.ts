export type FreqBand = {
	label: string;
	lowHz: number | null; // null = no low cut (starts at 0)
	highHz: number | null; // null = no high cut (extends to Nyquist)
};

export type BiquadCoeffs = { b0: number; b1: number; b2: number; a1: number; a2: number };

export function buildBands(frequencies: number[]): FreqBand[] {
	const sorted = [...frequencies].sort((a, b) => a - b);
	const bands: FreqBand[] = [];

	if (sorted.length === 0) {
		return [{ label: 'full', lowHz: null, highHz: null }];
	}

	bands.push({ label: `0–${sorted[0]} Hz`, lowHz: null, highHz: sorted[0] });

	for (let i = 0; i < sorted.length - 1; i++) {
		bands.push({
			label: `${sorted[i]}–${sorted[i + 1]} Hz`,
			lowHz: sorted[i],
			highHz: sorted[i + 1]
		});
	}

	bands.push({
		label: `${sorted[sorted.length - 1]}+ Hz`,
		lowHz: sorted[sorted.length - 1],
		highHz: null
	});
	bands.push({ label: 'full', lowHz: null, highHz: null });

	return bands;
}

function hpCoeffs(fc: number, fs: number): BiquadCoeffs {
	const Q = Math.SQRT1_2;
	const K = Math.tan((Math.PI * fc) / fs);
	const norm = 1 / (1 + K / Q + K * K);
	return {
		b0: norm,
		b1: -2 * norm,
		b2: norm,
		a1: 2 * (K * K - 1) * norm,
		a2: (1 - K / Q + K * K) * norm
	};
}

function lpCoeffs(fc: number, fs: number): BiquadCoeffs {
	const Q = Math.SQRT1_2;
	const K = Math.tan((Math.PI * fc) / fs);
	const norm = 1 / (1 + K / Q + K * K);
	return {
		b0: K * K * norm,
		b1: 2 * K * K * norm,
		b2: K * K * norm,
		a1: 2 * (K * K - 1) * norm,
		a2: (1 - K / Q + K * K) * norm
	};
}

// Returns LR4 filter stages for a band (2 cascaded biquads per cutoff).
// Empty array for the "full" band (no filtering).
export function buildBandCoeffs(band: FreqBand, sampleRate: number): BiquadCoeffs[] {
	const stages: BiquadCoeffs[] = [];
	if (band.lowHz !== null) {
		const c = hpCoeffs(band.lowHz, sampleRate);
		stages.push(c, c);
	}
	if (band.highHz !== null) {
		const c = lpCoeffs(band.highHz, sampleRate);
		stages.push(c, c);
	}
	return stages;
}
