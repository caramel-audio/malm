// Orchestrates the full analysis pipeline for all uploaded files
// Called when the user presses the process button

import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult } from '$lib/state/results.svelte';
import { buildBands, renderBand } from './filters';
import { measureLoudness } from './loudness';

// Analyze all files and return results; calls onProgress(0..1) as work proceeds
export async function analyzeFiles(
	files: AudioFile[],
	frequencies: number[],
	onProgress: (progress: number) => void,
): Promise<FileResult[]> {
	// TODO: implement
	//   1. buildBands(frequencies)
	//   2. for each file × band: renderBand → measureLoudness
	//   3. store filtered AudioBuffers back onto AudioFile.bandBuffers
	//   4. advance progress after each step
	throw new Error('Not implemented');
}
