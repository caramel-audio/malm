import { describe, it, expect } from 'vitest';
import { analysisSignature, splitForAnalysis } from './analysis';
import type { AudioFile } from '$lib/state/files.svelte';
import type { FileResult } from '$lib/state/results.svelte';

const file = (id: string) => ({ id, duration: 10 }) as AudioFile;

const SPECTROGRAM = {
	columns: 1,
	bins: 1,
	sampleRate: 48000,
	maxFrequency: 24000,
	data: 'AA=='
};

const result = (fileId: string, sig?: string, waveform: [number, number][] = [[0, 1]]) =>
	({ fileId, bands: [], sig, waveform, spectrogram: SPECTROGRAM }) as FileResult;

const SIG = analysisSignature([200, 2000], 'LR24');
const OTHER = analysisSignature([200, 2000], 'BW12');

describe('analysisSignature', () => {
	it('changes with the crossovers and with the slope', () => {
		expect(analysisSignature([200], 'LR24')).not.toBe(analysisSignature([300], 'LR24'));
		expect(SIG).not.toBe(OTHER);
	});

	it('ignores crossover order', () => {
		expect(analysisSignature([2000, 200], 'LR24')).toBe(SIG);
	});
});

describe('splitForAnalysis', () => {
	it('analyzes everything when there are no results', () => {
		const files = [file('a'), file('b')];
		const { reuse, todo } = splitForAnalysis(files, [], SIG);
		expect(reuse).toEqual([]);
		expect(todo.map((f) => f.id)).toEqual(['a', 'b']);
	});

	it('only analyzes the appended file', () => {
		const files = [file('a'), file('b')];
		const { reuse, todo } = splitForAnalysis(files, [result('a', SIG)], SIG);
		expect(reuse.map((r) => r.fileId)).toEqual(['a']);
		expect(todo.map((f) => f.id)).toEqual(['b']);
	});

	it('re-analyzes everything when the options changed', () => {
		const files = [file('a'), file('b')];
		const existing = [result('a', OTHER), result('b', OTHER)];
		const { reuse, todo } = splitForAnalysis(files, existing, SIG);
		expect(reuse).toEqual([]);
		expect(todo.map((f) => f.id)).toEqual(['a', 'b']);
	});

	it('re-analyzes results saved before signatures existed', () => {
		const { reuse, todo } = splitForAnalysis([file('a')], [result('a')], SIG);
		expect(reuse).toEqual([]);
		expect(todo.map((f) => f.id)).toEqual(['a']);
	});

	it('re-analyzes results that carry no waveform', () => {
		const legacy = result('a', SIG, []);
		const { reuse, todo } = splitForAnalysis([file('a')], [legacy], SIG);
		expect(reuse).toEqual([]);
		expect(todo.map((f) => f.id)).toEqual(['a']);
	});

	it('re-analyzes a file whose spectrogram is missing, keeping its bands', () => {
		const noSpec = { ...result('a', SIG), spectrogram: undefined };
		const { reuse, todo, carry } = splitForAnalysis([file('a')], [noSpec], SIG);
		expect(reuse).toEqual([]);
		expect(todo.map((f) => f.id)).toEqual(['a']);
		// The loudness half survives, so the pass only has to build the spectrogram.
		expect(carry.get('a')).toBe(noSpec);
	});

	it('keeps the spectrogram when only the crossovers changed', () => {
		const stale = result('a', OTHER);
		const { todo, carry } = splitForAnalysis([file('a')], [stale], SIG);
		expect(todo.map((f) => f.id)).toEqual(['a']);
		expect(carry.get('a')?.spectrogram).toBe(SPECTROGRAM);
	});

	it('drops results for files that are gone', () => {
		const existing = [result('a', SIG), result('gone', SIG)];
		const { reuse, todo } = splitForAnalysis([file('a')], existing, SIG);
		expect(reuse.map((r) => r.fileId)).toEqual(['a']);
		expect(todo).toEqual([]);
	});
});
