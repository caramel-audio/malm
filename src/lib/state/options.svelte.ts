// Analysis options state. Persistence is per-project via localStorage.

import { SLOPES, type Slope } from '$lib/audio/filters';

const DEFAULT_FREQUENCIES = [200, 2000];
const DEFAULT_SLOPE: Slope = 'LR24';

export const options = $state({
	frequencies: [...DEFAULT_FREQUENCIES],
	slope: DEFAULT_SLOPE as Slope,
	selectedBand: 'full',
	// Track kept at the top of the list and out of the scroll area.
	pinnedFileId: null as string | null,
	loudnessType: 'momentary' as 'momentary' | 'shortTerm',
	normalizeToQuietest: false,
	// Sticky readout lines per file id, in seconds.
	markers: {} as Record<string, number[]>
});

export function resetOptions(): void {
	options.frequencies = [...DEFAULT_FREQUENCIES];
	options.slope = DEFAULT_SLOPE;
	options.selectedBand = 'full';
	options.pinnedFileId = null;
	options.loudnessType = 'momentary';
	options.normalizeToQuietest = false;
	options.markers = {};
}

// Per-project persistence helpers (called by the project layout).

export function loadOptionsForProject(projectId: string): void {
	resetOptions();
	try {
		const raw = localStorage.getItem(`malm_project_${projectId}_options`);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed.frequencies) &&
			parsed.frequencies.every((x: unknown) => Number.isFinite(x) && (x as number) > 0)
		) {
			options.frequencies = parsed.frequencies;
		}
		if (SLOPES.includes(parsed.slope)) options.slope = parsed.slope;
		if (typeof parsed.selectedBand === 'string') options.selectedBand = parsed.selectedBand;
		if (typeof parsed.pinnedFileId === 'string') options.pinnedFileId = parsed.pinnedFileId;
		if (parsed.loudnessType === 'momentary' || parsed.loudnessType === 'shortTerm')
			options.loudnessType = parsed.loudnessType;
		if (typeof parsed.normalizeToQuietest === 'boolean')
			options.normalizeToQuietest = parsed.normalizeToQuietest;
		if (parsed.markers && typeof parsed.markers === 'object') {
			options.markers = Object.fromEntries(
				Object.entries(parsed.markers as Record<string, unknown>)
					.map(([id, ts]) => [id, Array.isArray(ts) ? ts.filter(Number.isFinite) : []])
					.filter(([, ts]) => (ts as number[]).length > 0)
			);
		}
	} catch {}
}

export function saveOptionsForProject(projectId: string): void {
	try {
		localStorage.setItem(
			`malm_project_${projectId}_options`,
			JSON.stringify({
				frequencies: options.frequencies,
				slope: options.slope,
				selectedBand: options.selectedBand,
				pinnedFileId: options.pinnedFileId,
				loudnessType: options.loudnessType,
				normalizeToQuietest: options.normalizeToQuietest,
				markers: options.markers
			})
		);
	} catch {}
}
