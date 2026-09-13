import { interpolateRgb } from 'd3';

/** m:ss — used by the transport bar, the track list and the plot time axis. */
export function formatTime(seconds: number): string {
	const s = Math.max(0, seconds);
	return `${Math.floor(s / 60)}:${Math.floor(s % 60)
		.toString()
		.padStart(2, '0')}`;
}

type Stops = readonly [number, string][];

/** Piecewise-linear colour ramp. Stops ascend by value; outside them it clamps. */
function ramp(stops: Stops, value: number): string {
	const last = stops[stops.length - 1];
	const clamped = Math.max(stops[0][0], Math.min(last[0], value));
	for (let i = 0; i < stops.length - 1; i++) {
		const [d0, c0] = stops[i];
		const [d1, c1] = stops[i + 1];
		if (clamped <= d1) return interpolateRgb(c0, c1)((clamped - d0) / (d1 - d0));
	}
	return last[1];
}

const LUFS_STOPS: Stops = [
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
	const color = ramp(LUFS_STOPS, lufs);
	return tint > 0 ? interpolateRgb(color, GREY)(tint) : color;
}

const BALANCE_STOPS: Stops = [
	[0, '#9ca3af'],
	[1, '#22c55e'],
	[3, '#eab308'],
	[6, '#ef4444']
];

/**
 * Colour for an L/R difference by *magnitude* — grey when centred, red when
 * badly lopsided. Which side it leans is read off the axis, not the colour.
 */
export function balanceColor(db: number): string {
	return ramp(BALANCE_STOPS, Math.abs(db));
}

const CORRELATION_STOPS: Stops = [
	[-1, '#ef4444'], // anti-phase: cancels on any mono playback
	[-0.3, '#f97316'], // partly inverted: vague, no solid centre
	[0, '#eab308'], // unrelated channels: very wide, worth a listen
	[0.3, '#22c55e'], // healthy stereo
	[1, '#22c55e'] // identical channels: mono, but not a fault
];

/**
 * Colour for a correlation coefficient, by *value* — unlike balance, the sign is
 * the whole story, so the ramp is not symmetric: green from +0.3 up, amber
 * through zero, red as it goes negative.
 */
export function correlationColor(r: number): string {
	return ramp(CORRELATION_STOPS, r);
}

/** Correlation, always signed: `+0.82`, `-0.15`. */
export function formatCorrelation(r: number): string {
	return `${r > 0 ? '+' : r < 0 ? '' : '±'}${r.toFixed(2)}`;
}

/** Signed dB, always with an explicit sign: `+1.2`, `-0.4`. */
export function formatSignedDb(db: number): string {
	return `${db > 0 ? '+' : db < 0 ? '' : '±'}${db.toFixed(1)}`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
