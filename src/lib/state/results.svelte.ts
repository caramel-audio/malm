// State for analysis results

import { options } from './options.svelte';

export type BandResult = {
	label: string; // e.g. "0-80 Hz", "full"
	// Arrays of [timeMs, loudnessLUFS] pairs
	momentary: [number, number][];
	shortTerm: [number, number][];
	// Peak dBFS per sample point [timeMs, peakDbfs]
	peak: [number, number][];
	// EBU R128 integrated LUFS (gated)
	integrated: number;
	// [timeMs, dB] by which left exceeds right over the short-term window.
	// Absent for mono sources and for results saved before this existed; steps
	// below the absolute gate are omitted, so this is sparser than `shortTerm`.
	balance?: [number, number][];
	// Same difference over the gated blocks behind `integrated`.
	balanceIntegrated?: number;
};

export type FileResult = {
	fileId: string;
	// Crossovers + slope this was measured with; results from before this
	// existed have none and are always re-analyzed.
	sig?: string;
	bands: BandResult[];
	// [min, max] of the raw signal per 100 ms — the stored waveform "peak file".
	// Optional: results saved before streaming analysis don't have it.
	waveform?: [number, number][];
};

export const results = $state<{ data: FileResult[]; isFresh: boolean }>({
	data: [],
	isFresh: false
});

export function setResults(data: FileResult[]): void {
	results.data = data;
	results.isFresh = true;
}

export function clearResults(): void {
	results.data = [];
	results.isFresh = false;
}

export function markResultsStale(): void {
	results.isFresh = false;
}

/** Integrated loudness of the full band (falls back to the first band). */
export function integratedFull(result: FileResult): number {
	return (result.bands.find((b) => b.label === 'full') ?? result.bands[0])?.integrated ?? -Infinity;
}

export function quietestFileId(): string | null {
	let quietest: { fileId: string; lufs: number } | null = null;
	for (const r of results.data) {
		const lufs = integratedFull(r);
		if (quietest === null || lufs < quietest.lufs) quietest = { fileId: r.fileId, lufs };
	}
	return quietest?.fileId ?? null;
}

/**
 * dB to add to a file so it matches the quietest one. 0 when normalization is
 * off. Shared by the plots (drawing), the transport readout and playback gain.
 */
export function lufsOffset(fileId: string): number {
	if (!options.normalizeToQuietest) return 0;
	const quietestId = quietestFileId();
	const quietest = results.data.find((r) => r.fileId === quietestId);
	const self = results.data.find((r) => r.fileId === fileId);
	if (!quietest || !self) return 0;
	const a = integratedFull(quietest);
	const b = integratedFull(self);
	return isFinite(a) && isFinite(b) ? a - b : 0;
}

/** Value of the sample nearest `timeMs`. Binary search — these series are long. */
export function nearestValue(data: [number, number][], timeMs: number): number | null {
	if (!data.length) return null;
	let lo = 0;
	let hi = data.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (data[mid][0] < timeMs) lo = mid + 1;
		else hi = mid;
	}
	// `<=` so an exact midpoint takes the earlier sample, as the linear scan
	// this replaced did.
	const prev = data[Math.max(0, lo - 1)];
	return Math.abs(prev[0] - timeMs) <= Math.abs(data[lo][0] - timeMs) ? prev[1] : data[lo][1];
}
