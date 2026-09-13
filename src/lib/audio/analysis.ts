import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands, type Slope } from './filters';
import { LoudnessMeter, WaveformAccumulator } from './loudness';
import { decodeAudioChunks } from './decode';

/** Identifies the settings a result was produced with. */
export function analysisSignature(frequencies: number[], slope: Slope): string {
	return `${[...frequencies].sort((a, b) => a - b).join(',')}|${slope}`;
}

/**
 * Which files still need analyzing: a result is reusable only if its file is
 * still loaded, it was measured with the current crossovers and slope, and it
 * is complete — results from older builds have no waveform to draw.
 */
export function splitForAnalysis(
	files: AudioFile[],
	existing: FileResult[],
	signature: string
): { reuse: FileResult[]; todo: AudioFile[] } {
	const usable = new Map(
		existing
			.filter((r) => r.sig === signature && r.waveform?.length)
			.map((r) => [r.fileId, r] as const)
	);
	const reuse: FileResult[] = [];
	const todo: AudioFile[] = [];
	for (const file of files) {
		const hit = usable.get(file.id);
		if (hit) reuse.push(hit);
		else todo.push(file);
	}
	return { reuse, todo };
}

/**
 * Analyzes only what `existing` does not already cover, and returns the full
 * result set ordered like `files`.
 */
export async function analyzeFiles(
	files: AudioFile[],
	frequencies: number[],
	slope: Slope,
	onProgress: (progress: number) => void,
	signal?: AbortSignal,
	existing: FileResult[] = []
): Promise<FileResult[]> {
	const bands = buildBands(frequencies);
	const signature = analysisSignature(frequencies, slope);
	const { reuse, todo } = splitForAnalysis(files, existing, signature);

	const totalDuration = todo.reduce((sum, f) => sum + (f.duration || 0), 0) || 1;
	let doneDuration = 0;

	const fileResults: FileResult[] = [...reuse];

	for (const file of todo) {
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
				meters = bands.map((b) => new LoudnessMeter(sampleRate, chunk.channels.length, b, slope));
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

		fileResults.push({
			fileId: file.id,
			sig: signature,
			bands: bandResults,
			waveform: waveform!.finish()
		});

		doneDuration += file.duration || 0;
		onProgress(Math.min(1, doneDuration / totalDuration));
	}

	const order = new Map(files.map((f, i) => [f.id, i]));
	return fileResults.sort((a, b) => (order.get(a.fileId) ?? 0) - (order.get(b.fileId) ?? 0));
}
