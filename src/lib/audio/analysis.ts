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
): Promise<FileResult[]> {
	const bands = buildBands(frequencies);
	const total = files.length * bands.length;
	let done = 0;

	const fileResults: FileResult[] = [];

	for (const file of files) {
		if (!file.buffer) continue;
		const bandResults: BandResult[] = [];

		for (const band of bands) {
			const filtered = await renderBand(file.buffer, band);
			file.bandBuffers[band.label] = filtered;
			const measurement = await measureLoudness(filtered);
			bandResults.push({ label: band.label, ...measurement });
			done++;
			onProgress(done / total);
		}

		fileResults.push({ fileId: file.id, bands: bandResults });
	}

	return fileResults;
}
