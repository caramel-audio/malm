// EBU R128 loudness measurement via @domchristie/needles
// Produces momentary (every 100 ms) and short-term (every 400 ms) LUFS values

import type { BandResult } from '$lib/state/results.svelte';

// TODO: import Meter from '@domchristie/needles'

// Measure loudness and peak for an AudioBuffer
// Returns arrays of [timeMs, value] pairs at the specified resolution
export async function measureLoudness(buffer: AudioBuffer): Promise<Omit<BandResult, 'label'>> {
	// TODO: implement
	//   - feed buffer samples into needles Meter
	//   - collect momentary values every 100 ms
	//   - collect short-term values every 400 ms
	//   - collect true peak per 100 ms window
	throw new Error('Not implemented');
}
