// Analysis options state. Persistence is per-project via localStorage.

import { SLOPES, type Slope } from '$lib/audio/filters';

const DEFAULT_FREQUENCIES = [200, 2000];
const DEFAULT_SLOPE: Slope = 'LR24';

/** Per-track row height in px, per tab. Spectrograms need the vertical room. */
export const ROW_HEIGHT_RANGE = { min: 100, max: 420 } as const;
export const SPECTROGRAM_ROW_HEIGHT_RANGE = { min: 140, max: 700 } as const;
const DEFAULT_ROW_HEIGHT = 180;
const DEFAULT_SPECTROGRAM_ROW_HEIGHT = 300;

function clamp(value: unknown, { min, max }: { min: number; max: number }): number | null {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: null;
}

/** What the plots draw: a loudness curve, or one of the two stereo views. */
export const LOUDNESS_TYPES = ['momentary', 'shortTerm', 'balance', 'correlation'] as const;
export type LoudnessType = (typeof LOUDNESS_TYPES)[number];

export const options = $state({
	frequencies: [...DEFAULT_FREQUENCIES],
	slope: DEFAULT_SLOPE as Slope,
	selectedBand: 'full',
	// Track kept at the top of the list and out of the scroll area.
	pinnedFileId: null as string | null,
	loudnessType: 'momentary' as LoudnessType,
	normalizeToQuietest: false,
	// Sticky readout lines per file id, in seconds.
	markers: {} as Record<string, number[]>,
	rowHeight: DEFAULT_ROW_HEIGHT,
	spectrogramRowHeight: DEFAULT_SPECTROGRAM_ROW_HEIGHT,
	// Log frequency axis on the spectrogram. Off by default: a codec cutoff is a
	// straight edge near the top, and log squeezes exactly that part flat.
	spectrogramLogFreq: false
});

export function resetOptions(): void {
	options.frequencies = [...DEFAULT_FREQUENCIES];
	options.slope = DEFAULT_SLOPE;
	options.selectedBand = 'full';
	options.pinnedFileId = null;
	options.loudnessType = 'momentary';
	options.normalizeToQuietest = false;
	options.markers = {};
	options.rowHeight = DEFAULT_ROW_HEIGHT;
	options.spectrogramRowHeight = DEFAULT_SPECTROGRAM_ROW_HEIGHT;
	options.spectrogramLogFreq = false;
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
		if (LOUDNESS_TYPES.includes(parsed.loudnessType)) options.loudnessType = parsed.loudnessType;
		if (typeof parsed.normalizeToQuietest === 'boolean')
			options.normalizeToQuietest = parsed.normalizeToQuietest;
		const rowHeight = clamp(parsed.rowHeight, ROW_HEIGHT_RANGE);
		if (rowHeight !== null) options.rowHeight = rowHeight;
		const specHeight = clamp(parsed.spectrogramRowHeight, SPECTROGRAM_ROW_HEIGHT_RANGE);
		if (specHeight !== null) options.spectrogramRowHeight = specHeight;
		if (typeof parsed.spectrogramLogFreq === 'boolean') {
			options.spectrogramLogFreq = parsed.spectrogramLogFreq;
		}
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
				markers: options.markers,
				rowHeight: options.rowHeight,
				spectrogramRowHeight: options.spectrogramRowHeight,
				spectrogramLogFreq: options.spectrogramLogFreq
			})
		);
	} catch {}
}
