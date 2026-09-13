import { describe, it, expect } from 'vitest';
import { pinnedFirst, type AudioFile } from './files.svelte';

const f = (id: string) => ({ id }) as AudioFile;
const ids = (list: AudioFile[]) => list.map((x) => x.id);

describe('pinnedFirst', () => {
	const list = [f('a'), f('b'), f('c')];

	it('keeps the order when nothing is pinned', () => {
		expect(pinnedFirst(list, null)).toBe(list);
	});

	it('moves the pinned track to the front', () => {
		expect(ids(pinnedFirst(list, 'c'))).toEqual(['c', 'a', 'b']);
	});

	it('is a no-op when the first track is already pinned', () => {
		expect(ids(pinnedFirst(list, 'a'))).toEqual(['a', 'b', 'c']);
	});

	it('ignores a pin pointing at a removed track', () => {
		expect(pinnedFirst(list, 'gone')).toBe(list);
	});

	it('does not mutate the source list', () => {
		pinnedFirst(list, 'c');
		expect(ids(list)).toEqual(['a', 'b', 'c']);
	});

	it('handles an empty list', () => {
		expect(pinnedFirst([], 'a')).toEqual([]);
	});
});
