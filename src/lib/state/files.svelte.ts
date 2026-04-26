// State for uploaded audio files
// Each entry holds the File object, decoded AudioBuffer, metadata, and per-band buffers

export type AudioFile = {
	id: string;
	file: File;
	name: string;
	artist: string;
	duration: number; // seconds
	buffer: AudioBuffer | null;
	// Filtered buffers keyed by band label (e.g. "0-80", "80-200", "full")
	bandBuffers: Record<string, AudioBuffer>;
};

export const files = $state<{ list: AudioFile[] }>({ list: [] });

// TODO: addFile(file: File) — decode audio, extract metadata, push to list
// TODO: removeFile(id: string)
// TODO: reorderFiles(from: number, to: number)
