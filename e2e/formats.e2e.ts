import { test, expect } from '@playwright/test';
import { seedProject, runAnalysis } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

// Formats a browser engine cannot decode via decodeAudioData (discovered empirically).
// Uploading these would hit the known uncaught-decode-error bug, so skip them.
const UNSUPPORTED: Record<string, RegExp[]> = {
	chromium: [/\.aiff$/], // Chromium's decodeAudioData has no AIFF support
	firefox: [/\.aiff$/], // Firefox can't decode AIFF either
	// webkit skipped entirely above (no OPFS)
	webkit: []
};

type Fixture = { file: string; sampleRate: string; duration: string | RegExp };

const FIXTURES: Fixture[] = [
	{ file: 'sine440-wav16-44k-stereo-5s.wav', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'sine440-wav16-44k-mono-0.5s.wav', sampleRate: '44.1 kHz', duration: '0:00' },
	{ file: 'sine3k-wav24-48k-stereo-5s.wav', sampleRate: '48 kHz', duration: '0:05' },
	{ file: 'sine80-wav32f-96k-stereo-5s.wav', sampleRate: '96 kHz', duration: '0:05' },
	{ file: 'pinknoise-wav16-44k-stereo-5s.wav', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'whitenoise-wav16-48k-mono-5s.wav', sampleRate: '48 kHz', duration: '0:05' },
	{ file: 'silence-wav16-44k-stereo-5s.wav', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'sweep-wav16-48k-stereo-5s.wav', sampleRate: '48 kHz', duration: '0:05' },
	{ file: 'sine440-flac-44k-stereo-5s.flac', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'sine440-flac-96k-stereo-5s.flac', sampleRate: '96 kHz', duration: '0:05' },
	{ file: 'sine440-mp3-44k-stereo-5s.mp3', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'pinknoise-mp3-44k-mono-5s.mp3', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'sine440-ogg-44k-stereo-5s.ogg', sampleRate: '44.1 kHz', duration: '0:05' },
	// opus trims encoder padding — duration can floor to 0:04
	{ file: 'sine440-opus-48k-stereo-5s.opus', sampleRate: '48 kHz', duration: /0:0[45]/ },
	{ file: 'sine440-m4a-44k-stereo-5s.m4a', sampleRate: '44.1 kHz', duration: '0:05' },
	{ file: 'sine440-aiff-44k-stereo-5s.aiff', sampleRate: '44.1 kHz', duration: '0:05' }
];

test.describe('format matrix: upload + decode', () => {
	for (const f of FIXTURES) {
		test(f.file, async ({ page, browserName }) => {
			test.skip(
				UNSUPPORTED[browserName].some((re) => re.test(f.file)),
				`${browserName} cannot decode this format`
			);
			await seedProject(page, [f.file]);
			const row = page.locator('ul li').first();
			await expect(row).toContainText(f.sampleRate);
			await expect(row).toContainText(f.duration);
		});
	}
});

test.describe('representative formats survive full analysis', () => {
	for (const file of [
		'sine440-wav16-44k-stereo-5s.wav',
		'sine440-flac-44k-stereo-5s.flac',
		'sine440-opus-48k-stereo-5s.opus'
	]) {
		test(file, async ({ page, browserName }) => {
			test.slow();
			test.skip(
				UNSUPPORTED[browserName].some((re) => re.test(file)),
				`${browserName} cannot decode this format`
			);
			await seedProject(page, [file]);
			await runAnalysis(page);
			await expect(page.getByText(/LUFS/i).first()).toBeVisible();
		});
	}
});
