import { describe, it, expect, beforeEach } from 'vitest';
import {
	presets,
	loadPresets,
	savePreset,
	deletePreset,
	applyPreset,
	projectCrossovers,
	defaultCrossoverForNewProject
} from './presets.svelte';
import { options, resetOptions } from './options.svelte';

describe('crossover presets', () => {
	beforeEach(() => {
		localStorage.clear();
		resetOptions();
		loadPresets();
	});

	it('starts empty', () => {
		expect(presets.list).toEqual([]);
	});

	it('saves and reloads a preset', () => {
		savePreset('Three way', [120, 3000], 'BW48');
		loadPresets();
		expect(presets.list).toEqual([{ name: 'Three way', frequencies: [120, 3000], slope: 'BW48' }]);
	});

	it('overwrites a preset of the same name instead of duplicating it', () => {
		savePreset('Mine', [100], 'LR24');
		savePreset('Mine', [200, 400], 'LR12');
		expect(presets.list).toHaveLength(1);
		expect(presets.list[0].frequencies).toEqual([200, 400]);
		expect(presets.list[0].slope).toBe('LR12');
	});

	it('deletes a preset', () => {
		savePreset('A', [100], 'LR24');
		savePreset('B', [200], 'LR24');
		deletePreset('A');
		expect(presets.list.map((p) => p.name)).toEqual(['B']);
	});

	it('applies a preset to the live options', () => {
		applyPreset({ frequencies: [80, 800, 8000], slope: 'BW12' });
		expect(options.frequencies).toEqual([80, 800, 8000]);
		expect(options.slope).toBe('BW12');
	});

	it('reads the crossovers of other projects', () => {
		localStorage.setItem(
			'malm_project_abc_options',
			JSON.stringify({ frequencies: [300], slope: 'LR48' })
		);
		localStorage.setItem('malm_project_broken_options', 'not json');
		const found = projectCrossovers([
			{ id: 'abc', name: 'Mix A' },
			{ id: 'broken', name: 'Broken' },
			{ id: 'missing', name: 'Never opened' }
		]);
		expect(found).toEqual([{ id: 'abc', name: 'Mix A', frequencies: [300], slope: 'LR48' }]);
	});

	it('seeds a new project from the most recently updated one', () => {
		localStorage.setItem(
			'malm_project_old_options',
			JSON.stringify({ frequencies: [100], slope: 'LR24' })
		);
		localStorage.setItem(
			'malm_project_new_options',
			JSON.stringify({ frequencies: [250, 2500], slope: 'BW24' })
		);
		const seed = defaultCrossoverForNewProject([
			{ id: 'old', name: 'Old', updatedAt: 1 },
			{ id: 'new', name: 'New', updatedAt: 2 }
		]);
		expect(seed).toEqual({ frequencies: [250, 2500], slope: 'BW24' });
	});

	it('falls back to the defaults when no project has crossovers yet', () => {
		expect(defaultCrossoverForNewProject([])).toBeNull();
	});
});
