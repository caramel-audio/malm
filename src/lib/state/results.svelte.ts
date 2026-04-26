// State for analysis results

export type BandResult = {
	label: string; // e.g. "0-80 Hz", "full"
	// Arrays of [timeMs, loudnessLUFS] pairs
	momentary: [number, number][];
	shortTerm: [number, number][];
	// Peak dBFS per sample point [timeMs, peakDbfs]
	peak: [number, number][];
};

export type FileResult = {
	fileId: string;
	bands: BandResult[];
};

export const results = $state<{ data: FileResult[] }>({ data: [] });

// TODO: setResults(data: FileResult[])
// TODO: clearResults()
