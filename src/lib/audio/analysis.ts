// Orchestrates the full analysis pipeline for all uploaded files
// Called when the user presses the process button

import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands, renderBand } from './filters';
import { measureLoudness } from './loudness';

// Analyze all files and return results; calls onProgress(0..1) as work proceeds
// Clamp peaks > 1.0 caused by IIR filter overshoot; leaves signals already within range untouched
function peakClamp(buffer: AudioBuffer): AudioBuffer {
	let peak = 0;
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const data = buffer.getChannelData(ch);
		for (let i = 0; i < data.length; i++) {
			const abs = Math.abs(data[i]);
			if (abs > peak) peak = abs;
		}
	}
	if (peak <= 1.0) return buffer;
	const gain = 0.99 / peak;
	const out = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length: buffer.length, sampleRate: buffer.sampleRate });
	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const src = buffer.getChannelData(ch);
		const dst = out.getChannelData(ch);
		for (let i = 0; i < src.length; i++) dst[i] = src[i] * gain;
	}
	return out;
}

export async function analyzeFiles(
	files: AudioFile[],
	frequencies: number[],
	onProgress: (progress: number) => void,
	signal?: AbortSignal,
): Promise<FileResult[]> {
	const bands = buildBands(frequencies);
	const total = files.length * bands.length;
	let done = 0;

	const fileResults: FileResult[] = [];

	for (const file of files) {
		if (!file.buffer) continue;
		signal?.throwIfAborted();

		const bandResults = await Promise.all(bands.map(async (band) => {
			signal?.throwIfAborted();
			const filtered = peakClamp(await renderBand(file.buffer!, band));
			const measurement = await measureLoudness(filtered);
			done++;
			onProgress(done / total);
			return { label: band.label, ...measurement } satisfies BandResult;
		}));

		fileResults.push({ fileId: file.id, bands: bandResults });
		await new Promise((r) => setTimeout(r, 0));
	}

	return fileResults;
}
