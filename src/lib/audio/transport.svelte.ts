// The app-aware layer over the raw playback element: knows which files exist,
// which band is selected and how loud each band is, so every caller (transport
// bar, plot clicks, keyboard) goes through one place.

import { files, type AudioFile } from '$lib/state/files.svelte';
import { options } from '$lib/state/options.svelte';
import {
	results,
	lufsOffset,
	nearestValue,
	type BandResult,
	type FileResult
} from '$lib/state/results.svelte';
import { buildBands, type FreqBand } from './filters';
import { playback, playbackHooks, play, seek, togglePlayPause } from './playback.svelte';

export type Hover = {
	fileId: string;
	time: number;
	momentary: number | null;
	shortTerm: number | null;
	peak: number | null;
};

export const transport = $state({
	repeat: false,
	hover: null as Hover | null
});

export function currentFile(): AudioFile | null {
	return files.list.find((f) => f.id === playback.currentFileId) ?? null;
}

export function currentBand(): FreqBand | null {
	return buildBands(options.frequencies).find((b) => b.label === options.selectedBand) ?? null;
}

function bandResultFor(fileId: string): BandResult | undefined {
	const result: FileResult | undefined = results.data.find((r) => r.fileId === fileId);
	return result?.bands.find((b) => b.label === options.selectedBand);
}

/**
 * Playing a single band sounds louder than its share of the mix, so drop it by
 * the difference between its integrated loudness and the full band's. Combined
 * with the normalization offset so the ear hears what the plot draws.
 */
export function gainDbFor(fileId: string): number {
	const offset = lufsOffset(fileId);
	if (options.selectedBand === 'full') return offset;
	const result = results.data.find((r) => r.fileId === fileId);
	const band = bandResultFor(fileId);
	const full = result?.bands.find((b) => b.label === 'full')?.integrated;
	if (!band || full === undefined || !isFinite(band.integrated) || !isFinite(full)) return offset;
	return offset + band.integrated - full;
}

export function playTrack(fileId: string, offsetSeconds = 0): void {
	const file = files.list.find((f) => f.id === fileId);
	if (!file) return;
	play(file.id, file.file, currentBand(), options.slope, offsetSeconds, gainDbFor(file.id));
}

/** Play/pause the current track, or start the first one when nothing is loaded. */
export function toggle(): void {
	if (playback.currentFileId) togglePlayPause();
	else if (files.list.length > 0) playTrack(files.list[0].id, 0);
}

export function seekTo(seconds: number): void {
	if (playback.currentFileId) seek(seconds);
	else if (files.list.length > 0) playTrack(files.list[0].id, seconds);
}

export function seekBy(deltaSeconds: number): void {
	seekTo(playback.currentTime + deltaSeconds);
}

export function restart(): void {
	seekTo(0);
}

/** Re-applies the current band/slope to whatever is playing, keeping position. */
export function reapplyBand(): void {
	if (!playback.isPlaying || !playback.currentFileId) return;
	playTrack(playback.currentFileId, playback.currentTime);
}

export type Readout = {
	hovering: boolean;
	time: number | null;
	peak: number | null;
	momentary: number | null;
	shortTerm: number | null;
};

const EMPTY: Readout = {
	hovering: false,
	time: null,
	peak: null,
	momentary: null,
	shortTerm: null
};

/**
 * What the transport bar shows: the hovered plot's values while the pointer is
 * over one, otherwise the playing track's values at the playhead.
 */
export function readout(): Readout {
	const h = transport.hover;
	if (h) {
		const offset = lufsOffset(h.fileId);
		return {
			hovering: true,
			time: h.time,
			peak: h.peak,
			momentary: h.momentary === null ? null : h.momentary + offset,
			shortTerm: h.shortTerm === null ? null : h.shortTerm + offset
		};
	}

	const fileId = playback.currentFileId;
	if (!fileId) return EMPTY;
	const band = bandResultFor(fileId);
	if (!band) return { ...EMPTY, time: playback.currentTime };
	const offset = lufsOffset(fileId);
	const timeMs = playback.currentTime * 1000;
	const mom = nearestValue(band.momentary, timeMs);
	const st = nearestValue(band.shortTerm, timeMs);
	return {
		hovering: false,
		time: playback.currentTime,
		peak: nearestValue(band.peak, timeMs),
		momentary: mom === null ? null : mom + offset,
		shortTerm: st === null ? null : st + offset
	};
}

playbackHooks.onEnded = (fileId) => {
	if (transport.repeat && fileId) playTrack(fileId, 0);
};
