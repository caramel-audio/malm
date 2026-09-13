import { test, expect } from '@playwright/test';
import { seedProject, runAnalysis, SHORT_WAV, SHORT_WAV2, TINY_WAV } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

const row = (page: import('@playwright/test').Page, i: number) => page.locator('ul li').nth(i);

test.describe('pinned track', () => {
	test('pinning moves a track to the top of the list', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await expect(row(page, 0)).toContainText('pinknoise');
		await expect(row(page, 1)).toContainText('sine440');
	});

	test('only one track stays pinned, and unpinning restores the order', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2, TINY_WAV]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await expect(row(page, 0)).toContainText('pinknoise');
		await page.getByRole('button', { name: /^Pin sine440-wav16-44k-mono/ }).click();
		await expect(row(page, 0)).toContainText('sine440-wav16-44k-mono');
		await expect(page.getByRole('button', { name: /^Unpin/ })).toHaveCount(1);
		await page.getByRole('button', { name: /^Unpin/ }).click();
		await expect(row(page, 0)).toContainText('sine440-wav16-44k-stereo');
	});

	test('the pinned plot stays put while the others scroll', async ({ page }) => {
		test.slow();
		await seedProject(page, [
			SHORT_WAV,
			SHORT_WAV2,
			TINY_WAV,
			'sine3k-wav24-48k-stereo-5s.wav',
			'whitenoise-wav16-48k-mono-5s.wav'
		]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await runAnalysis(page);

		const pinned = page.getByTestId('pinned-plot');
		await expect(pinned).toBeVisible();
		const before = (await pinned.boundingBox())!;

		const scroller = page.getByTestId('plot-scroll');
		await scroller.evaluate((el) => el.scrollBy(0, 400));
		await expect.poll(async () => (await scroller.evaluate((el) => el.scrollTop)) > 0).toBe(true);

		const after = (await pinned.boundingBox())!;
		expect(after.y).toBe(before.y);
	});

	test('the pin survives a reload', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await page.waitForTimeout(500); // > 300ms save debounce
		await page.reload();
		await expect(row(page, 0)).toContainText('pinknoise');
	});
});
