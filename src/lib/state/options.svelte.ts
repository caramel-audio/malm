// State for analysis options

const STORAGE_KEY = 'malm_frequencies';
const DEFAULT_FREQUENCIES = [200, 2000];

function loadFrequencies(): number[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.every((x) => Number.isFinite(x) && x > 0)) {
				return parsed;
			}
		}
	} catch {}
	return [...DEFAULT_FREQUENCIES];
}

function saveFrequencies(freqs: number[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(freqs));
	} catch {}
}

export const options = $state({
	// Crossover frequencies in Hz; bands are the intervals between them
	frequencies: loadFrequencies(),
	isAnalyzing: false,
	progress: 0,
});

export function addFrequency(hz: number): void {
	if (options.frequencies.includes(hz)) return;
	options.frequencies.push(hz);
	options.frequencies.sort((a, b) => a - b);
	saveFrequencies(options.frequencies);
}

export function removeFrequency(hz: number): void {
	const idx = options.frequencies.indexOf(hz);
	if (idx !== -1) options.frequencies.splice(idx, 1);
	saveFrequencies(options.frequencies);
}

export function resetOptions(): void {
	options.frequencies = [...DEFAULT_FREQUENCIES];
	options.isAnalyzing = false;
	options.progress = 0;
	saveFrequencies(options.frequencies);
}
