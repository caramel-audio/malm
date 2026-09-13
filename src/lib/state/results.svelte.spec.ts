import { describe, it, expect, beforeEach } from 'vitest';
import {
	results,
	setResults,
	clearResults,
	integratedFull,
	quietestFileId,
	lufsOffset,
	nearestValue,
	type FileResult
} from './results.svelte';
import { options, resetOptions } from './options.svelte';

const band = (label: string, integrated: number) => ({
	label,
	momentary: [] as [number, number][],
	shortTerm: [] as [number, number][],
	peak: [] as [number, number][],
	integrated
});

const fileResult = (fileId: string, full: number, low = full - 10): FileResult => ({
	fileId,
	bands: [band('0–200 Hz', low), band('full', full)]
});

describe('nearestValue', () => {
	// 0, 100, 200 … 990 ms — the shape of a real momentary series
	const series = Array.from({ length: 100 }, (_, i) => [i * 100, i] as [number, number]);

	it('returns null for an empty series', () => {
		expect(nearestValue([], 500)).toBeNull();
	});

	it('finds the exact sample', () => {
		expect(nearestValue(series, 0)).toBe(0);
		expect(nearestValue(series, 4200)).toBe(42);
		expect(nearestValue(series, 9900)).toBe(99);
	});

	it('rounds to the nearer neighbour on both sides of the midpoint', () => {
		expect(nearestValue(series, 4240)).toBe(42);
		expect(nearestValue(series, 4260)).toBe(43);
	});

	it('clamps past both ends', () => {
		expect(nearestValue(series, -5000)).toBe(0);
		expect(nearestValue(series, 999_999)).toBe(99);
	});

	it('handles a single-sample series', () => {
		expect(nearestValue([[500, 7]], 0)).toBe(7);
		expect(nearestValue([[500, 7]], 100_000)).toBe(7);
	});

	it('agrees with a linear scan on every query point', () => {
		const linear = (data: [number, number][], t: number) =>
			data.reduce((best, d) => (Math.abs(d[0] - t) < Math.abs(best[0] - t) ? d : best), data[0])[1];
		for (let t = -200; t <= 10_200; t += 37) {
			expect(nearestValue(series, t)).toBe(linear(series, t));
		}
	});
});

describe('result helpers', () => {
	beforeEach(() => {
		clearResults();
		resetOptions();
	});

	it('reads the full band, falling back to the first band', () => {
		expect(integratedFull(fileResult('a', -14))).toBe(-14);
		expect(integratedFull({ fileId: 'b', bands: [band('0–200 Hz', -30)] })).toBe(-30);
		expect(integratedFull({ fileId: 'c', bands: [] })).toBe(-Infinity);
	});

	it('finds the quietest file', () => {
		setResults([fileResult('loud', -10), fileResult('quiet', -25), fileResult('mid', -18)]);
		expect(quietestFileId()).toBe('quiet');
	});

	it('has no quietest file without results', () => {
		expect(quietestFileId()).toBeNull();
	});

	it('offsets nothing while normalization is off', () => {
		setResults([fileResult('loud', -10), fileResult('quiet', -25)]);
		expect(lufsOffset('loud')).toBe(0);
	});

	it('pulls every file down to the quietest one', () => {
		setResults([fileResult('loud', -10), fileResult('quiet', -25)]);
		options.normalizeToQuietest = true;
		expect(lufsOffset('loud')).toBeCloseTo(-15, 10);
		expect(lufsOffset('quiet')).toBe(0);
	});

	it('does not offset when a file measured as silence', () => {
		setResults([fileResult('music', -10), fileResult('silence', -Infinity)]);
		options.normalizeToQuietest = true;
		// -Infinity is the quietest, but scaling to it is meaningless — leave it alone
		expect(lufsOffset('music')).toBe(0);
		expect(lufsOffset('silence')).toBe(0);
	});

	it('ignores unknown file ids', () => {
		setResults([fileResult('a', -10)]);
		options.normalizeToQuietest = true;
		expect(lufsOffset('nope')).toBe(0);
	});

	it('marks results fresh on set and stale on clear', () => {
		setResults([fileResult('a', -10)]);
		expect(results.isFresh).toBe(true);
		clearResults();
		expect(results.isFresh).toBe(false);
		expect(results.data).toEqual([]);
	});
});
