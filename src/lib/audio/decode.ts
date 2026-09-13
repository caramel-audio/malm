// Streaming audio decode. Never holds full PCM in memory — yields small chunks
// so multi-hour files can be analysed without decoding them into one AudioBuffer.

import { Input, BlobSource, ALL_FORMATS, AudioBufferSink } from 'mediabunny';

export type AudioChunk = {
	channels: Float32Array[];
	sampleRate: number;
	length: number;
};

export type AudioProbe = {
	duration: number;
	sampleRate: number;
	numberOfChannels: number;
};

function openInput(file: File): Input {
	return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

export async function probeAudio(file: File): Promise<AudioProbe | null> {
	try {
		const input = openInput(file);
		const track = await input.getPrimaryAudioTrack();
		if (!track) return null;
		return {
			duration: await input.computeDuration(),
			sampleRate: await track.getSampleRate(),
			numberOfChannels: await track.getNumberOfChannels()
		};
	} catch {
		return null;
	}
}

function toChunk(buffer: AudioBuffer): AudioChunk {
	return {
		channels: Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch)),
		sampleRate: buffer.sampleRate,
		length: buffer.length
	};
}

/**
 * Yields decoded PCM in presentation order. Uses mediabunny (WebCodecs) when it
 * can handle the format, otherwise falls back to a one-shot `decodeAudioData`
 * (single chunk) so exotic formats keep working as before.
 */
export async function* decodeAudioChunks(file: File): AsyncGenerator<AudioChunk> {
	let yielded = false;
	try {
		const track = await openInput(file).getPrimaryAudioTrack();
		if (track && (await track.canDecode())) {
			for await (const { buffer } of new AudioBufferSink(track).buffers()) {
				if (buffer.length === 0) continue;
				yielded = true;
				yield toChunk(buffer);
			}
			return;
		}
	} catch (e) {
		// Once chunks have been emitted there is no safe way to restart — surface it.
		if (yielded) throw e;
	}

	const ctx = new AudioContext();
	try {
		yield toChunk(await ctx.decodeAudioData(await file.arrayBuffer()));
	} finally {
		ctx.close();
	}
}
