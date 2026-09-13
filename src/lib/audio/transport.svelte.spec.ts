import { describe, it, expect, beforeEach } from 'vitest';
import { transport, gainDbFor, readout, currentFile, currentBand } from './transport.svelte';
import { playback } from './playback.svelte';
import { files, type AudioFile } from '$lib/state/files.svelte';
import { options, resetOptions } from '$lib/state/options.svelte';
import { setResults, clearResults, type FileResult } from '$lib/state/results.svelte';

const audioFile = (id: string, name = id): AudioFile =>
	({ id, name, artist: '', duration: 60 }) as AudioFile;

const series = (value: number): [number, number][] =>
	Array.from({ length: 10 }, (_, i) => [i * 1000, value + i] as [number, number]);

const band = (label: string, integrated: number) => ({
	label,
	momentary: series(-20),
	shortTerm: series(-25),
	peak: series(-6),
	integrated
});

const fileResult = (fileId: string): FileResult => ({
	fileId,
	bands: [band('0–200 Hz', -30), band('200–2000 Hz', -22), band('full', -14)]
});

describe('transport', () => {
	beforeEach(() => {
		resetOptions();
		clearResults();
		files.list = [audioFile('a', 'Track A'), audioFile('b', 'Track B')];
		setResults([fileResult('a'), fileResult('b')]);
		playback.currentFileId = null;
		playback.currentTime = 0;
		playback.isPlaying = false;
		transport.hover = null;
		transport.repeat = false;
	});

	describe('currentFile / currentBand', () => {
		it('is null when nothing is loaded', () => {
			expect(currentFile()).toBeNull();
		});

		it('resolves the playing file and the selected band', () => {
			playback.currentFileId = 'b';
			expect(currentFile()?.name).toBe('Track B');
			options.selectedBand = '0–200 Hz';
			expect(currentBand()).toEqual({ label: '0–200 Hz', lowHz: null, highHz: 200 });
		});

		it('has no band object for the full band', () => {
			options.selectedBand = 'full';
			expect(currentBand()).toEqual({ label: 'full', lowHz: null, highHz: null });
		});
	});

	describe('gainDbFor', () => {
		it('is unity on the full band with normalization off', () => {
			expect(gainDbFor('a')).toBe(0);
		});

		it('drops a band by how much quieter it is than the full mix', () => {
			options.selectedBand = '0–200 Hz';
			expect(gainDbFor('a')).toBeCloseTo(-16, 10); // -30 - (-14)
			options.selectedBand = '200–2000 Hz';
			expect(gainDbFor('a')).toBeCloseTo(-8, 10);
		});

		it('adds the normalization offset on top of the band gain', () => {
			setResults([
				{ fileId: 'a', bands: [band('0–200 Hz', -30), band('full', -14)] },
				{ fileId: 'b', bands: [band('0–200 Hz', -40), band('full', -24)] }
			]);
			options.normalizeToQuietest = true;
			options.selectedBand = '0–200 Hz';
			// a is 10 dB louder than the quietest file, and its low band is 16 dB down
			expect(gainDbFor('a')).toBeCloseTo(-26, 10);
			expect(gainDbFor('b')).toBeCloseTo(-16, 10);
		});

		it('falls back to the offset alone when the band has no finite measurement', () => {
			setResults([{ fileId: 'a', bands: [band('0–200 Hz', -Infinity), band('full', -14)] }]);
			options.selectedBand = '0–200 Hz';
			expect(gainDbFor('a')).toBe(0);
		});

		it('is silent about files it has no results for', () => {
			options.selectedBand = '0–200 Hz';
			expect(gainDbFor('unknown')).toBe(0);
		});
	});

	describe('readout', () => {
		it('is empty when nothing plays and nothing is hovered', () => {
			expect(readout()).toEqual({
				hovering: false,
				time: null,
				peak: null,
				momentary: null,
				shortTerm: null
			});
		});

		it('follows the playhead of the playing file', () => {
			playback.currentFileId = 'a';
			playback.currentTime = 3;
			const r = readout();
			expect(r.hovering).toBe(false);
			expect(r.time).toBe(3);
			expect(r.momentary).toBe(-17); // series(-20)[3]
			expect(r.shortTerm).toBe(-22);
			expect(r.peak).toBe(-3);
		});

		it('prefers hover values over the playhead', () => {
			playback.currentFileId = 'a';
			playback.currentTime = 3;
			transport.hover = { fileId: 'b', time: 9, momentary: -11, shortTerm: -12, peak: -1 };
			const r = readout();
			expect(r.hovering).toBe(true);
			expect(r.time).toBe(9);
			expect(r.momentary).toBe(-11);
			expect(r.shortTerm).toBe(-12);
			expect(r.peak).toBe(-1);
		});

		it('applies the normalization offset to both hover and playhead values', () => {
			setResults([
				{ fileId: 'a', bands: [band('full', -14)] },
				{ fileId: 'b', bands: [band('full', -24)] }
			]);
			options.normalizeToQuietest = true;

			transport.hover = { fileId: 'a', time: 1, momentary: -20, shortTerm: -25, peak: -6 };
			expect(readout().momentary).toBeCloseTo(-30, 10); // a is 10 dB above the quietest

			transport.hover = null;
			playback.currentFileId = 'a';
			playback.currentTime = 0;
			expect(readout().momentary).toBeCloseTo(-30, 10);
			// peak is a raw sample level — normalization must not move it
			expect(readout().peak).toBe(-6);
		});

		it('reports the time but no values when the selected band was never measured', () => {
			playback.currentFileId = 'a';
			playback.currentTime = 2;
			options.selectedBand = '2000+ Hz';
			expect(readout()).toEqual({
				hovering: false,
				time: 2,
				peak: null,
				momentary: null,
				shortTerm: null
			});
		});

		it('survives a hover on a file that has no results', () => {
			transport.hover = { fileId: 'ghost', time: 1, momentary: -20, shortTerm: -25, peak: -6 };
			const r = readout();
			expect(r.hovering).toBe(true);
			expect(r.momentary).toBe(-20);
		});
	});
});
