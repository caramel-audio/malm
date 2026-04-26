// Orchestrates the full analysis pipeline for all uploaded files
// Called when the user presses the process button

import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult, BandResult } from '$lib/state/results.svelte';
import { buildBands, renderBand } from './filters';
import { measureLoudness } from './loudness';

// Analyze all files and return results; calls onProgress(0..1) as work proceeds
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
			const filtered = await renderBand(file.buffer!, band);
			file.bandBuffers[band.label] = filtered;
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
