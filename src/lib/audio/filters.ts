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
	// TODO: implement
	return [];
}

// Apply a single band's filter chain to an AudioBuffer and return the filtered AudioBuffer
export async function renderBand(
	source: AudioBuffer,
	band: FreqBand,
): Promise<AudioBuffer> {
	// TODO: implement using OfflineAudioContext + BiquadFilterNode cascade
	throw new Error('Not implemented');
}
