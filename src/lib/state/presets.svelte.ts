// Saved crossover settings, shared across projects. Small enough for
// localStorage — the per-project copy still lives under malm_project_{id}_options.

import { SLOPES, type Slope } from '$lib/audio/filters';
import { options } from './options.svelte';

export type CrossoverPreset = {
	name: string;
	frequencies: number[];
	slope: Slope;
};

const STORAGE_KEY = 'malm_crossover_presets';

export const presets = $state<{ list: CrossoverPreset[] }>({ list: [] });

function isFrequencies(x: unknown): x is number[] {
	return Array.isArray(x) && x.every((f) => Number.isFinite(f) && (f as number) > 0);
}

function asSlope(x: unknown): Slope {
	return SLOPES.includes(x as Slope) ? (x as Slope) : 'LR24';
}

export function loadPresets(): void {
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		presets.list = (Array.isArray(parsed) ? parsed : [])
			.filter((p) => typeof p?.name === 'string' && isFrequencies(p.frequencies))
			.map((p) => ({ name: p.name, frequencies: p.frequencies, slope: asSlope(p.slope) }));
	} catch {
		presets.list = [];
	}
}

function persist(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.list));
	} catch {}
}

/** Saving under an existing name replaces it — that is the expected "update". */
export function savePreset(name: string, frequencies: number[], slope: Slope): void {
	const trimmed = name.trim() || 'Untitled';
	const preset = { name: trimmed, frequencies: [...frequencies], slope };
	const existing = presets.list.findIndex((p) => p.name === trimmed);
	if (existing >= 0) presets.list[existing] = preset;
	else presets.list.push(preset);
	persist();
}

export function deletePreset(name: string): void {
	presets.list = presets.list.filter((p) => p.name !== name);
	persist();
}

export function applyPreset(preset: Pick<CrossoverPreset, 'frequencies' | 'slope'>): void {
	options.frequencies = [...preset.frequencies];
	options.slope = preset.slope;
}

function readProjectCrossover(id: string): { frequencies: number[]; slope: Slope } | null {
	try {
		const parsed = JSON.parse(localStorage.getItem(`malm_project_${id}_options`) ?? 'null');
		if (!parsed || !isFrequencies(parsed.frequencies)) return null;
		return { frequencies: parsed.frequencies, slope: asSlope(parsed.slope) };
	} catch {
		return null;
	}
}

/** The crossovers of every project that has some — for "load from project". */
export function projectCrossovers<T extends { id: string; name: string }>(
	projects: T[]
): (CrossoverPreset & { id: string })[] {
	return projects.flatMap((p) => {
		const found = readProjectCrossover(p.id);
		return found ? [{ id: p.id, name: p.name, ...found }] : [];
	});
}

/** A new project inherits the crossovers of the most recently updated one. */
export function defaultCrossoverForNewProject<T extends { id: string; updatedAt: number }>(
	projects: T[]
): { frequencies: number[]; slope: Slope } | null {
	const newestFirst = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
	for (const p of newestFirst) {
		const found = readProjectCrossover(p.id);
		if (found) return found;
	}
	return null;
}
