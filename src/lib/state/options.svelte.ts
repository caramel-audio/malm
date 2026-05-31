// Analysis options state. Persistence is per-project via localStorage.

const DEFAULT_FREQUENCIES = [200, 2000];

export const options = $state({
	frequencies: [...DEFAULT_FREQUENCIES],
	isAnalyzing: false,
	progress: 0
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

// Per-project persistence helpers (called by the project layout).

export function loadOptionsForProject(projectId: string): void {
	try {
		const raw = localStorage.getItem(`malm_project_${projectId}_options`);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed.frequencies) && parsed.frequencies.every((x: unknown) => Number.isFinite(x) && (x as number) > 0)) {
				options.frequencies = parsed.frequencies;
				return;
			}
		}
	} catch {}
	options.frequencies = [...DEFAULT_FREQUENCIES];
}

export function saveOptionsForProject(projectId: string): void {
	try {
		localStorage.setItem(
			`malm_project_${projectId}_options`,
			JSON.stringify({ frequencies: options.frequencies })
		);
	} catch {}
}
