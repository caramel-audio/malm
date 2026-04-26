// State for analysis options

export const options = $state({
	// Crossover frequencies in Hz; bands are the intervals between them
	frequencies: [80, 200, 800, 2000, 8000],
	isAnalyzing: false,
});

// TODO: addFrequency(hz: number)
// TODO: removeFrequency(hz: number)
// TODO: reset()
