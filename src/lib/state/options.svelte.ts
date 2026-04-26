// State for analysis options

const DEFAULT_FREQUENCIES = [80, 200, 800, 2000, 8000];

export const options = $state({
	// Crossover frequencies in Hz; bands are the intervals between them
	frequencies: [...DEFAULT_FREQUENCIES],
	isAnalyzing: false,
	progress: 0,
});

export function addFrequency(hz: number): void {
	if (options.frequencies.includes(hz)) return;
	options.frequencies.push(hz);
	options.frequencies.sort((a, b) => a - b);
}

export function removeFrequency(hz: number): void {
	const idx = options.frequencies.indexOf(hz);
	if (idx !== -1) options.frequencies.splice(idx, 1);
}

export function resetOptions(): void {
	options.frequencies = [...DEFAULT_FREQUENCIES];
	options.isAnalyzing = false;
	options.progress = 0;
}
