// Butterworth bandpass/highpass/lowpass filters for splitting audio into energy bands
// Filter order: 24 dB/oct (4th order Butterworth)

// TODO: buildFilterChain(ctx: OfflineAudioContext, source: AudioBufferSourceNode, bands: FreqBand[])
//       Returns one OfflineAudioContext render per band

export type FreqBand = {
	label: string;
	lowHz: number | null;  // null = no low cut (starts at 0)
	highHz: number | null; // null = no high cut (extends to Nyquist)
};

// Derive bands from a sorted list of crossover frequencies, plus a "full" band
export function buildBands(frequencies: number[]): FreqBand[] {
	const sorted = [...frequencies].sort((a, b) => a - b);
	const bands: FreqBand[] = [];

	if (sorted.length === 0) {
		return [{ label: 'full', lowHz: null, highHz: null }];
	}

	bands.push({ label: `0–${sorted[0]} Hz`, lowHz: null, highHz: sorted[0] });

	for (let i = 0; i < sorted.length - 1; i++) {
		bands.push({ label: `${sorted[i]}–${sorted[i + 1]} Hz`, lowHz: sorted[i], highHz: sorted[i + 1] });
	}

	bands.push({ label: `${sorted[sorted.length - 1]}+ Hz`, lowHz: sorted[sorted.length - 1], highHz: null });
	bands.push({ label: 'full', lowHz: null, highHz: null });

	return bands;
}

// Apply a single band's filter chain to an AudioBuffer and return the filtered AudioBuffer
// 24 dB/oct achieved by cascading 2× biquad filters of the same type at the same frequency
export async function renderBand(source: AudioBuffer, band: FreqBand): Promise<AudioBuffer> {
	if (band.lowHz === null && band.highHz === null) {
		return source;
	}

	const ctx = new OfflineAudioContext(
		source.numberOfChannels,
		source.length,
		source.sampleRate,
	);

	const src = ctx.createBufferSource();
	src.buffer = source;

	let node: AudioNode = src;

	if (band.lowHz !== null) {
		const hp1 = ctx.createBiquadFilter();
		hp1.type = 'highpass';
		hp1.frequency.value = band.lowHz;
		const hp2 = ctx.createBiquadFilter();
		hp2.type = 'highpass';
		hp2.frequency.value = band.lowHz;
		node.connect(hp1);
		hp1.connect(hp2);
		node = hp2;
	}

	if (band.highHz !== null) {
		const lp1 = ctx.createBiquadFilter();
		lp1.type = 'lowpass';
		lp1.frequency.value = band.highHz;
		const lp2 = ctx.createBiquadFilter();
		lp2.type = 'lowpass';
		lp2.frequency.value = band.highHz;
		node.connect(lp1);
		lp1.connect(lp2);
		node = lp2;
	}

	node.connect(ctx.destination);
	src.start(0);

	return ctx.startRendering();
}
