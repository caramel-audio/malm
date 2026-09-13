import { describe, it, expect } from 'vitest';
import { formatTime, formatBytes, lufsColor } from './format';

describe('formatTime', () => {
	it('formats m:ss', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(5)).toBe('0:05');
		expect(formatTime(65)).toBe('1:05');
		expect(formatTime(3600)).toBe('60:00');
	});

	it('truncates rather than rounds, so the clock never shows a time not reached', () => {
		expect(formatTime(59.9)).toBe('0:59');
	});

	it('clamps negatives instead of printing "-1:-1"', () => {
		expect(formatTime(-10)).toBe('0:00');
	});
});

describe('formatBytes', () => {
	it('scales to KB, MB and GB', () => {
		expect(formatBytes(500)).toBe('0 KB');
		expect(formatBytes(1024 * 500)).toBe('500 KB');
		expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB');
		expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.00 GB');
	});
});

// Invariants only — the stop values are a tuning decision and may move.
describe('lufsColor', () => {
	const rgb = (css: string) => css.match(/\d+/g)!.map(Number);

	it('always returns a parseable rgb colour', () => {
		for (const lufs of [-80, -40, -23, -14, -5, 0]) {
			expect(rgb(lufsColor(lufs))).toHaveLength(3);
		}
	});

	it('clamps outside the scale instead of extrapolating', () => {
		expect(lufsColor(-200)).toBe(lufsColor(-100));
		expect(lufsColor(20)).toBe(lufsColor(100));
	});

	// It is a hue ramp (blue → green → yellow → red), so no single channel runs
	// monotonically — green has less red in it than blue does. Pin the ends.
	it('runs from blue at the quiet end to red at the loud end', () => {
		const [qr, , qb] = rgb(lufsColor(-40));
		const [lr, , lb] = rgb(lufsColor(0));
		expect(qb).toBeGreaterThan(qr); // quiet: blue dominates
		expect(lr).toBeGreaterThan(lb); // loud: red dominates
		expect(lr).toBeGreaterThan(qr);
	});

	it('passes through a green mid-range rather than jumping blue to red', () => {
		const mid = [-30, -25, -20, -15].map((l) => rgb(lufsColor(l)));
		expect(mid.some(([r, g, b]) => g > r && g > b)).toBe(true);
	});

	it('is continuous — no jump between neighbouring levels', () => {
		for (let lufs = -40; lufs < 0; lufs += 0.5) {
			const a = rgb(lufsColor(lufs));
			const b = rgb(lufsColor(lufs + 0.5));
			const jump = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
			expect(jump).toBeLessThan(40);
		}
	});
});
