export const playback = $state({
	currentFileId: null as string | null,
	currentTime: 0,
	isPlaying: false,
	isPaused: false,
});

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let startContextTime = 0;
let startOffset = 0;
let rafId: number | null = null;

function tick() {
	if (ctx && playback.isPlaying) {
		playback.currentTime = startOffset + (ctx.currentTime - startContextTime);
		rafId = requestAnimationFrame(tick);
	}
}

export function play(fileId: string, buffer: AudioBuffer, offsetSeconds: number): void {
	stop();

	if (!ctx) ctx = new AudioContext();
	if (ctx.state === 'suspended') ctx.resume();

	source = ctx.createBufferSource();
	source.buffer = buffer;
	source.connect(ctx.destination);

	startContextTime = ctx.currentTime;
	startOffset = Math.max(0, offsetSeconds);

	source.start(0, startOffset);
	source.onended = () => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
		source = null;
		playback.isPlaying = false;
		playback.isPaused = false;
		playback.currentFileId = null;
		playback.currentTime = 0;
	};

	playback.currentFileId = fileId;
	playback.currentTime = startOffset;
	playback.isPlaying = true;
	playback.isPaused = false;

	rafId = requestAnimationFrame(tick);
}

export async function pause(): Promise<void> {
	if (!ctx || !playback.isPlaying) return;
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	await ctx.suspend();
	playback.isPlaying = false;
	playback.isPaused = true;
}

export async function resume(): Promise<void> {
	if (!ctx || !playback.isPaused) return;
	await ctx.resume();
	// ctx.currentTime did not advance while suspended, so startContextTime is still valid
	playback.isPlaying = true;
	playback.isPaused = false;
	rafId = requestAnimationFrame(tick);
}

export async function togglePlayPause(): Promise<void> {
	if (playback.isPlaying) await pause();
	else if (playback.isPaused) await resume();
}

export function stop(): void {
	if (source) {
		source.onended = null;
		try {
			source.stop();
		} catch {
			// already stopped
		}
		source.disconnect();
		source = null;
	}
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	playback.isPlaying = false;
	playback.isPaused = false;
	playback.currentFileId = null;
}
