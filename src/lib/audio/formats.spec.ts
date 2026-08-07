import { describe, it, expect } from 'vitest';
import { isLikelyAudioFile, mimeTypeFor } from './formats';

function fakeFile(name: string, type = ''): File {
	return new File([new Uint8Array([0])], name, { type });
}

describe('isLikelyAudioFile', () => {
	it('accepts audio files that arrive without a MIME type', () => {
		expect(isLikelyAudioFile(fakeFile('track.flac'))).toBe(true);
	});

	it('accepts unknown extensions when the MIME type says audio', () => {
		expect(isLikelyAudioFile(fakeFile('recording', 'audio/mpeg'))).toBe(true);
	});

	it('rejects non-audio documents', () => {
		expect(isLikelyAudioFile(fakeFile('notes.pdf', 'application/pdf'))).toBe(false);
	});
});

describe('mimeTypeFor', () => {
	it('keeps the browser-reported type', () => {
		expect(mimeTypeFor(fakeFile('track.flac', 'audio/x-flac'))).toBe('audio/x-flac');
	});

	it('falls back to the extension when the type is empty', () => {
		expect(mimeTypeFor(fakeFile('track.flac'))).toBe('audio/flac');
	});

	it('returns an empty string for unknown extensions', () => {
		expect(mimeTypeFor(fakeFile('track.xyz'))).toBe('');
	});
});
