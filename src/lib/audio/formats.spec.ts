import { describe, it, expect, afterEach, vi } from 'vitest';
import { AUDIO_ACCEPT, isIosLike, isLikelyAudioFile, mimeTypeFor } from './formats';

function fakeFile(name: string, type = ''): File {
	return new File([new Uint8Array([0])], name, { type });
}

function stubNavigator(userAgent: string, maxTouchPoints: number): void {
	vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AUDIO_ACCEPT', () => {
	it('lists explicit types instead of the audio/* wildcard', () => {
		expect(AUDIO_ACCEPT).not.toContain('audio/*');
	});

	it('covers the common lossless formats by extension and MIME type', () => {
		for (const token of ['.flac', '.wav', '.aiff', '.m4a', 'audio/flac', 'audio/mp4']) {
			expect(AUDIO_ACCEPT.split(',')).toContain(token);
		}
	});
});

describe('isIosLike', () => {
	it('detects iPhone', () => {
		stubNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5);
		expect(isIosLike()).toBe(true);
	});

	it('detects iPadOS, which reports itself as macOS', () => {
		stubNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari', 5);
		expect(isIosLike()).toBe(true);
	});

	it('does not match desktop macOS', () => {
		stubNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari', 0);
		expect(isIosLike()).toBe(false);
	});
});

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
