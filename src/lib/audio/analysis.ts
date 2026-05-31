import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands } from './filters';
import { measureLoudness } from './loudness';

export async function analyzeFiles(
	files: AudioFile[],
	frequencies: number[],
	onProgress: (progress: number) => void,
	signal?: AbortSignal
): Promise<FileResult[]> {
	const bands = buildBands(frequencies);
	const total = files.length * bands.length;
	let done = 0;

	const fileResults: FileResult[] = [];

	for (const file of files) {
		if (!file.buffer) continue;
		signal?.throwIfAborted();

		const bandResults: BandResult[] = [];
		for (const band of bands) {
			signal?.throwIfAborted();
			const measurement = await measureLoudness(file.buffer, band);
			done++;
			onProgress(done / total);
			bandResults.push({ label: band.label, ...measurement });
		}

		fileResults.push({ fileId: file.id, bands: bandResults });
	}

	return fileResults;
}
