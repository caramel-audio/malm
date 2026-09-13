import { analyzeFiles } from '$lib/audio/analysis';
import { files } from './files.svelte';
import { options } from './options.svelte';
import { results, setResults } from './results.svelte';

export const analysis = $state({ isAnalyzing: false, progress: 0 });

let abortController: AbortController | null = null;

export function resetAnalysis(): void {
	abortController?.abort();
	abortController = null;
	analysis.isAnalyzing = false;
	analysis.progress = 0;
}

/**
 * The one way to start an analysis — the Analyze bar in setup and the
 * re-analyze buttons in both result tabs all land here, so a single decode pass
 * fills whatever is missing (loudness, spectrogram, or both).
 *
 * Returns false if it was cancelled.
 */
export async function runAnalysis(): Promise<boolean> {
	abortController = new AbortController();
	analysis.isAnalyzing = true;
	analysis.progress = 0;
	// Results are kept, not cleared: analyzeFiles reuses the ones that still
	// match the current files and settings and only measures the difference.
	const existing = [...results.data];
	try {
		const data = await analyzeFiles(
			files.list,
			options.frequencies,
			options.slope,
			(p) => {
				analysis.progress = p;
			},
			abortController.signal,
			existing
		);
		setResults(data);
		return true;
	} catch (e) {
		if (!(e instanceof Error && e.name === 'AbortError')) throw e;
		return false;
	} finally {
		analysis.isAnalyzing = false;
		analysis.progress = 0;
		abortController = null;
	}
}

export function cancelAnalysis(): void {
	abortController?.abort();
}
