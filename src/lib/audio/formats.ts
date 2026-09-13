// Audio file type helpers.
//
// The file input carries no `accept` attribute: iOS/iPadOS Safari turns that
// list into UTIs and greys out every document it cannot match, which is what
// made audio files unselectable on iPad. Filtering happens here instead —
// by extension/MIME first, then by whether the file actually decodes.

export const AUDIO_EXTENSIONS = [
	'mp3',
	'mp2',
	'wav',
	'wave',
	'flac',
	'm4a',
	'm4b',
	'mp4',
	'aac',
	'adts',
	'ogg',
	'oga',
	'opus',
	'aif',
	'aiff',
	'aifc',
	'caf',
	'wma',
	'webm',
	'weba'
];

const AUDIO_MIME_TYPES = [
	'audio/mpeg',
	'audio/mp3',
	'audio/mp4',
	'audio/x-m4a',
	'audio/aac',
	'audio/aacp',
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/vnd.wave',
	'audio/flac',
	'audio/x-flac',
	'audio/ogg',
	'audio/opus',
	'audio/aiff',
	'audio/x-aiff',
	'audio/x-caf',
	'audio/webm'
];

export function extensionOf(fileName: string): string {
	const idx = fileName.lastIndexOf('.');
	return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

const MIME_BY_EXTENSION: Record<string, string> = {
	mp3: 'audio/mpeg',
	mp2: 'audio/mpeg',
	wav: 'audio/wav',
	wave: 'audio/wav',
	flac: 'audio/flac',
	m4a: 'audio/mp4',
	m4b: 'audio/mp4',
	mp4: 'audio/mp4',
	aac: 'audio/aac',
	adts: 'audio/aac',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	opus: 'audio/opus',
	aif: 'audio/aiff',
	aiff: 'audio/aiff',
	aifc: 'audio/aiff',
	caf: 'audio/x-caf',
	webm: 'audio/webm',
	weba: 'audio/webm'
};

/**
 * Files picked on iOS/iPadOS frequently arrive with an empty `type`; fall back
 * to the extension so the stored manifest keeps a usable MIME type.
 */
export function mimeTypeFor(file: File): string {
	return file.type || MIME_BY_EXTENSION[extensionOf(file.name)] || '';
}

/** Cheap pre-filter; decoding is the real test of whether a file is usable. */
export function isLikelyAudioFile(file: File): boolean {
	if (AUDIO_EXTENSIONS.includes(extensionOf(file.name))) return true;
	const type = file.type.toLowerCase();
	// Files picked from iCloud/Files often arrive with an empty type; let those
	// through rather than rejecting a valid track.
	if (!type) return true;
	return type.startsWith('audio/') || AUDIO_MIME_TYPES.includes(type);
}
