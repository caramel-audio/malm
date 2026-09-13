import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands } from './filters';
import { LoudnessMeter, WaveformAccumulator } from './loudness';
import { decodeAudioChunks } from './decode';

export async function analyzeFiles(
	files: AudioFile[],
	frequencies: number[],
	onProgress: (progress: number) => void,
	signal?: AbortSignal
): Promise<FileResult[]> {
	const bands = buildBands(frequencies);
	const totalDuration = files.reduce((sum, f) => sum + (f.duration || 0), 0) || 1;
	let doneDuration = 0;

	const fileResults: FileResult[] = [];

	for (const file of files) {
		signal?.throwIfAborted();

		// One decode pass per file feeds every band meter.
		let meters: LoudnessMeter[] | null = null;
		let waveform: WaveformAccumulator | null = null;
		let sampleRate = 0;
		let fedSamples = 0;
		let lastYieldAt = 0;

		for await (const chunk of decodeAudioChunks(file.file)) {
			signal?.throwIfAborted();

			if (!meters) {
				sampleRate = chunk.sampleRate;
				meters = bands.map((b) => new LoudnessMeter(sampleRate, chunk.channels.length, b));
				waveform = new WaveformAccumulator(sampleRate);
			}

			for (const meter of meters) meter.feed(chunk.channels);
			waveform!.feed(chunk.channels);
			fedSamples += chunk.length;

			// Feeding is sync-heavy — hand the event loop back every ~0.5 s of audio.
			if (fedSamples - lastYieldAt >= sampleRate * 0.5) {
				lastYieldAt = fedSamples;
				const fileFraction = Math.min(1, fedSamples / sampleRate / (file.duration || Infinity));
				onProgress(
					Math.min(1, (doneDuration + fileFraction * (file.duration || 0)) / totalDuration)
				);
				await new Promise((r) => setTimeout(r, 0));
			}
		}

		if (!meters) continue;

		const bandResults: BandResult[] = bands.map((band, i) => ({
			label: band.label,
			...meters![i].finish()
		}));

		fileResults.push({ fileId: file.id, bands: bandResults, waveform: waveform!.finish() });

		doneDuration += file.duration || 0;
		onProgress(Math.min(1, doneDuration / totalDuration));
	}

	return fileResults;
}
