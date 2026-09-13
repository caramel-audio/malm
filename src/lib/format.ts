import { interpolateRgb } from 'd3';

/** m:ss — used by the transport bar, the track list and the plot time axis. */
export function formatTime(seconds: number): string {
	const s = Math.max(0, seconds);
	return `${Math.floor(s / 60)}:${Math.floor(s % 60)
		.toString()
		.padStart(2, '0')}`;
}

const LUFS_STOPS: [number, string][] = [
	[-35, '#3b82f6'],
	[-28, '#3b82f6'],
	[-20, '#22c55e'],
	[-12, '#eab308'],
	[-8, '#ef4444']
];

/**
 * Blue (quiet) → red (loud). Shared by the plot line and the transport readout.
 * `tint` mixes toward grey: the transport uses a half-tint while it is merely
 * following the playhead, and full colour when the user is hovering a plot.
 */
const GREY = '#9ca3af';

export function lufsColor(lufs: number, tint = 0): string {
	const clamped = Math.max(LUFS_STOPS[0][0], Math.min(LUFS_STOPS[LUFS_STOPS.length - 1][0], lufs));
	let color = LUFS_STOPS[LUFS_STOPS.length - 1][1];
	for (let i = 0; i < LUFS_STOPS.length - 1; i++) {
		const [d0, c0] = LUFS_STOPS[i];
		const [d1, c1] = LUFS_STOPS[i + 1];
		if (clamped <= d1) {
			color = interpolateRgb(c0, c1)((clamped - d0) / (d1 - d0));
			break;
		}
	}
	return tint > 0 ? interpolateRgb(color, GREY)(tint) : color;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
