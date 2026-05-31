// State for analysis results

export type BandResult = {
	label: string; // e.g. "0-80 Hz", "full"
	// Arrays of [timeMs, loudnessLUFS] pairs
	momentary: [number, number][];
	shortTerm: [number, number][];
	// Peak dBFS per sample point [timeMs, peakDbfs]
	peak: [number, number][];
	// EBU R128 integrated LUFS (gated)
	integrated: number;
};

export type FileResult = {
	fileId: string;
	bands: BandResult[];
};

export const results = $state<{ data: FileResult[]; isFresh: boolean }>({ data: [], isFresh: false });

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
