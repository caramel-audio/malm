import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands, type Slope } from './filters';
import { LoudnessMeter, WaveformAccumulator } from './loudness';
import { SpectrogramAccumulator } from './spectrogram';
import { decodeAudioChunks } from './decode';

/** Identifies the settings a result was produced with. */
export function analysisSignature(frequencies: number[], slope: Slope): string {
	return `${[...frequencies].sort((a, b) => a - b).join(',')}|${slope}`;
}

/** Whether a stored result's loudness half is still valid for these settings. */
function lufsValid(result: FileResult | undefined, signature: string): boolean {
	return !!result && result.sig === signature && !!result.waveform?.length;
}

/**
 * Which files still need analyzing, and which halves of their result survive.
 *
 * Loudness depends on the crossovers and the slope; the spectrogram does not —
 * it only depends on the audio. So changing a crossover re-measures loudness
 * while the spectrogram is carried over, and vice versa. A file only lands in
 * `reuse` when both halves are still good.
 */
export function splitForAnalysis(
	files: AudioFile[],
	existing: FileResult[],
	signature: string
): { reuse: FileResult[]; todo: AudioFile[]; carry: Map<string, FileResult> } {
	const byId = new Map(existing.map((r) => [r.fileId, r] as const));
	const reuse: FileResult[] = [];
	const todo: AudioFile[] = [];
	const carry = new Map<string, FileResult>();

	for (const file of files) {
		const hit = byId.get(file.id);
		if (lufsValid(hit, signature) && hit!.spectrogram) {
			reuse.push(hit!);
		} else {
			todo.push(file);
			if (hit) carry.set(file.id, hit);
		}
	}
	return { reuse, todo, carry };
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
	const { reuse, todo, carry } = splitForAnalysis(files, existing, signature);

	const totalDuration = todo.reduce((sum, f) => sum + (f.duration || 0), 0) || 1;
	let doneDuration = 0;

	const fileResults: FileResult[] = [...reuse];

	for (const file of todo) {
		signal?.throwIfAborted();

		// Only measure the halves that are actually missing — appending a track or
		// nudging a crossover should not redo work that is still valid.
		const previous = carry.get(file.id);
		const needLufs = !lufsValid(previous, signature);
		const needSpectrogram = !previous?.spectrogram;

		// One decode pass per file feeds every band meter, the waveform and the STFT.
		let started = false;
		let meters: LoudnessMeter[] = [];
		let waveform: WaveformAccumulator | null = null;
		let spectrogram: SpectrogramAccumulator | null = null;
		let sampleRate = 0;
		let fedSamples = 0;
		let lastYieldAt = 0;

		for await (const chunk of decodeAudioChunks(file.file)) {
			signal?.throwIfAborted();

			if (!started) {
				started = true;
				sampleRate = chunk.sampleRate;
				if (needLufs) {
					meters = bands.map((b) => new LoudnessMeter(sampleRate, chunk.channels.length, b, slope));
					waveform = new WaveformAccumulator(sampleRate);
				}
				if (needSpectrogram) {
					spectrogram = new SpectrogramAccumulator(sampleRate, file.duration || 0);
				}
			}

			for (const meter of meters) meter.feed(chunk.channels);
			waveform?.feed(chunk.channels);
			spectrogram?.feed(chunk.channels);
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

		if (!started) continue;

		const bandResults: BandResult[] = needLufs
			? bands.map((band, i) => ({ label: band.label, ...meters[i].finish() }))
			: previous!.bands;

		fileResults.push({
			fileId: file.id,
			sig: signature,
			bands: bandResults,
			waveform: needLufs ? waveform!.finish() : previous!.waveform,
			spectrogram: spectrogram ? (spectrogram.finish() ?? undefined) : previous!.spectrogram
		});

		doneDuration += file.duration || 0;
		onProgress(Math.min(1, doneDuration / totalDuration));
	}

	const order = new Map(files.map((f, i) => [f.id, i]));
	return fileResults.sort((a, b) => (order.get(a.fileId) ?? 0) - (order.get(b.fileId) ?? 0));
}
