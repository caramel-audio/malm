import { test, expect } from '@playwright/test';
import { seedProject, uploadFiles, fx, SHORT_WAV, SHORT_WAV2, TINY_WAV } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

const row = (page: import('@playwright/test').Page, i: number) => page.locator('ul li').nth(i);

test.describe('upload', () => {
	test('single file shows name, sample rate and duration', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		const r = row(page, 0);
		await expect(r).toContainText('sine440-wav16-44k-stereo-5s');
		await expect(r).toContainText('44.1 kHz');
		await expect(r).toContainText('0:05');
	});

	test('multiple files in one drop keep selection order', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2, TINY_WAV]);
		await expect(page.locator('ul li')).toHaveCount(3);
		await expect(row(page, 0)).toContainText('sine440-wav16-44k-stereo-5s');
		await expect(row(page, 1)).toContainText('pinknoise-wav16-44k-stereo-5s');
		await expect(row(page, 2)).toContainText('sine440-wav16-44k-mono-0.5s');
	});

	test('tagged mp3 shows title, artist and album', async ({ page }) => {
		await seedProject(page, ['sine440-tagged-5s.mp3']);
		const r = row(page, 0);
		await expect(r).toContainText('Test Song');
		await expect(r).toContainText('Test Artist');
		await expect(r).toContainText('Test Album');
	});

	test('untagged file parses "Artist - Title" from filename', async ({ page }) => {
		await seedProject(page, ['Fallback Artist - Fallback Song.wav']);
		const r = row(page, 0);
		await expect(r).toContainText('Fallback Song');
		await expect(r).toContainText('Fallback Artist');
	});

	test('remove file', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Remove sine440/ }).click();
		await expect(page.locator('ul li')).toHaveCount(1);
		await expect(row(page, 0)).toContainText('pinknoise');
	});

	test('re-upload same file after removal works (input resets)', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		await page.getByRole('button', { name: /^Remove sine440/ }).click();
		await expect(page.locator('ul li')).toHaveCount(0);
		await uploadFiles(page, SHORT_WAV);
		await expect(page.locator('ul li')).toHaveCount(1);
	});

	test('drag row to reorder', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		await uploadFiles(page, SHORT_WAV2);
		// HTML5 DnD: synthesize dragstart/drop with a shared DataTransfer
		await page.evaluate(() => {
			const rows = document.querySelectorAll('ul li');
			const dt = new DataTransfer();
			rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
			rows[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
			rows[1].dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
			rows[0].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
		});
		await expect(row(page, 0)).toContainText('pinknoise');
		await expect(row(page, 1)).toContainText('sine440');
	});

	test('multi-file drop survives a reload (manifest writes are serialized)', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2, TINY_WAV]);
		await page.reload();
		await expect(page.locator('ul li')).toHaveCount(3);
		await expect(row(page, 0)).toContainText('sine440-wav16-44k-stereo-5s');
		await expect(row(page, 1)).toContainText('pinknoise-wav16-44k-stereo-5s');
		await expect(row(page, 2)).toContainText('sine440-wav16-44k-mono-0.5s');
	});

	test('corrupt file shows an error instead of hanging', async ({ page }) => {
		await seedProject(page, []);
		await page.locator('input[type=file]').setInputFiles(fx('corrupt.wav'));
		await expect(page.getByText('LOADING...')).toBeHidden({ timeout: 10_000 });
	});

	test('non-audio file shows an error instead of hanging', async ({ page }) => {
		await seedProject(page, []);
		await page.locator('input[type=file]').setInputFiles(fx('notaudio.txt'));
		await expect(page.getByText('LOADING...')).toBeHidden({ timeout: 10_000 });
	});
});
