// Analysis options state. Persistence is per-project via localStorage.

const DEFAULT_FREQUENCIES = [200, 2000];

export const options = $state({
	frequencies: [...DEFAULT_FREQUENCIES],
	isAnalyzing: false,
	progress: 0,
	selectedBand: 'full',
	loudnessType: 'momentary' as 'momentary' | 'shortTerm',
	normalizeToQuietest: false
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
	options.selectedBand = 'full';
	options.loudnessType = 'momentary';
	options.normalizeToQuietest = false;
}

// Per-project persistence helpers (called by the project layout).

export function loadOptionsForProject(projectId: string): void {
	try {
		const raw = localStorage.getItem(`malm_project_${projectId}_options`);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed.frequencies) && parsed.frequencies.every((x: unknown) => Number.isFinite(x) && (x as number) > 0)) {
				options.frequencies = parsed.frequencies;
			} else {
				options.frequencies = [...DEFAULT_FREQUENCIES];
			}
			if (typeof parsed.selectedBand === 'string') options.selectedBand = parsed.selectedBand;
			if (parsed.loudnessType === 'momentary' || parsed.loudnessType === 'shortTerm') options.loudnessType = parsed.loudnessType;
			if (typeof parsed.normalizeToQuietest === 'boolean') options.normalizeToQuietest = parsed.normalizeToQuietest;
			return;
		}
	} catch {}
	options.frequencies = [...DEFAULT_FREQUENCIES];
	options.selectedBand = 'full';
	options.loudnessType = 'momentary';
	options.normalizeToQuietest = false;
}

export function saveOptionsForProject(projectId: string): void {
	try {
		localStorage.setItem(
			`malm_project_${projectId}_options`,
			JSON.stringify({
				frequencies: options.frequencies,
				selectedBand: options.selectedBand,
				loudnessType: options.loudnessType,
				normalizeToQuietest: options.normalizeToQuietest
			})
		);
	} catch {}
}
