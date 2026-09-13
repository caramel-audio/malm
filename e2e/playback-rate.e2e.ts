import { test, expect } from '@playwright/test';
import { skipSplash, createProject, uploadFiles, runAnalysis } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

/**
 * Guards against reapplyBand() re-entering on every animation frame. It reads
 * playback.currentTime, which ticks per frame, so calling it from an $effect
 * made that effect its own dependency: the filter graph was rebuilt and the
 * element re-seeked 60×/s. The playhead still advanced, so only the seek rate
 * exposes it — every seek flushes the decoder, which is the noise you hear.
 */
test('playing does not re-seek the element every frame', async ({ page }) => {
	await skipSplash(page);
	await page.addInitScript(() => {
		const w = window as unknown as { __seeks: number; __plays: number };
		w.__seeks = 0;
		w.__plays = 0;
		const proto = HTMLMediaElement.prototype;
		const ct = Object.getOwnPropertyDescriptor(proto, 'currentTime')!;
		Object.defineProperty(proto, 'currentTime', {
			...ct,
			set(v: number) {
				w.__seeks++;
				ct.set!.call(this, v);
			}
		});
		const play = proto.play;
		proto.play = function (this: HTMLMediaElement) {
			w.__plays++;
			return play.call(this);
		};
	});

	await createProject(page);
	await uploadFiles(page, 'pinknoise-wav16-44k-stereo-60s.wav');
	await runAnalysis(page);

	await page.getByRole('button', { name: 'Play' }).click();
	await page.waitForTimeout(500);
	const before = await page.evaluate(() => [
		(window as unknown as { __seeks: number }).__seeks,
		(window as unknown as { __plays: number }).__plays
	]);
	await page.waitForTimeout(3000);
	const after = await page.evaluate(() => [
		(window as unknown as { __seeks: number }).__seeks,
		(window as unknown as { __plays: number }).__plays
	]);

	// Steady playback touches neither. The loop produced ~60 of each per second.
	expect(after[0] - before[0]).toBeLessThan(5);
	expect(after[1] - before[1]).toBeLessThan(5);
});
