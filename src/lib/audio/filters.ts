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

export const SLOPES = ['LR12', 'LR24', 'LR48', 'BW12', 'BW24', 'BW48'] as const;
export type Slope = (typeof SLOPES)[number];

export const SLOPE_LABELS: Record<Slope, string> = {
	LR12: 'LR 12 dB/oct',
	LR24: 'LR 24 dB/oct',
	LR48: 'LR 48 dB/oct',
	BW12: 'BW 12 dB/oct',
	BW24: 'BW 24 dB/oct',
	BW48: 'BW 48 dB/oct'
};

// Butterworth pole Qs per section, 1/(2·cos((2k+1)π/2n)). A Linkwitz-Riley of
// order n is the Butterworth of order n/2 cascaded twice — LR12's half is a
// plain 1st-order section, marked here by a null Q.
const BW_SECTIONS: Record<string, (number | null)[]> = {
	1: [null],
	2: [Math.SQRT1_2],
	4: [0.5411961001461969, 1.3065629648763766],
	8: [0.5097955791041592, 0.6013448869350453, 0.8999762231364156, 2.5629154477415055]
};

const SLOPE_SECTIONS: Record<Slope, (number | null)[]> = {
	BW12: BW_SECTIONS[2],
	BW24: BW_SECTIONS[4],
	BW48: BW_SECTIONS[8],
	LR12: [...BW_SECTIONS[1], ...BW_SECTIONS[1]],
	LR24: [...BW_SECTIONS[2], ...BW_SECTIONS[2]],
	LR48: [...BW_SECTIONS[4], ...BW_SECTIONS[4]]
};

// A 1st-order section fits the biquad shape with its second-order terms zeroed,
// so the sample loops stay untouched.
function firstOrderCoeffs(fc: number, fs: number, highpass: boolean): BiquadCoeffs {
	const K = Math.tan((Math.PI * fc) / fs);
	const norm = 1 / (1 + K);
	return highpass
		? { b0: norm, b1: -norm, b2: 0, a1: (K - 1) * norm, a2: 0 }
		: { b0: K * norm, b1: K * norm, b2: 0, a1: (K - 1) * norm, a2: 0 };
}

function sectionCoeffs(fc: number, fs: number, Q: number | null, highpass: boolean): BiquadCoeffs {
	if (Q === null) return firstOrderCoeffs(fc, fs, highpass);
	const K = Math.tan((Math.PI * fc) / fs);
	const norm = 1 / (1 + K / Q + K * K);
	const a1 = 2 * (K * K - 1) * norm;
	const a2 = (1 - K / Q + K * K) * norm;
	return highpass
		? { b0: norm, b1: -2 * norm, b2: norm, a1, a2 }
		: { b0: K * K * norm, b1: 2 * K * K * norm, b2: K * K * norm, a1, a2 };
}

// Returns the cascaded filter stages for a band at the given slope.
// Empty array for the "full" band (no filtering).
export function buildBandCoeffs(
	band: FreqBand,
	sampleRate: number,
	slope: Slope = 'LR24'
): BiquadCoeffs[] {
	const sections = SLOPE_SECTIONS[slope] ?? SLOPE_SECTIONS.LR24;
	const stages: BiquadCoeffs[] = [];
	if (band.lowHz !== null) {
		for (const Q of sections) stages.push(sectionCoeffs(band.lowHz, sampleRate, Q, true));
	}
	if (band.highHz !== null) {
		for (const Q of sections) stages.push(sectionCoeffs(band.highHz, sampleRate, Q, false));
	}
	return stages;
}
