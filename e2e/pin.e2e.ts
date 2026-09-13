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

	test('dragging still moves the right row while a track is pinned', async ({ page }) => {
		// Display order differs from files.list order once something is pinned, so
		// the drag handlers work on mapped indices — this is what checks the map.
		await seedProject(page, [SHORT_WAV, SHORT_WAV2, TINY_WAV]);
		await page.getByRole('button', { name: /^Pin sine440-wav16-44k-mono/ }).click();
		await expect(row(page, 0)).toContainText('sine440-wav16-44k-mono');

		// drag the displayed row 1 (stereo sine) onto row 2 (pinknoise)
		await page.evaluate(() => {
			const rows = document.querySelectorAll('ul li');
			const dt = new DataTransfer();
			rows[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
			rows[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
			rows[2].dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
			rows[1].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
		});

		await expect(row(page, 0)).toContainText('sine440-wav16-44k-mono'); // pin unaffected
		await expect(row(page, 1)).toContainText('pinknoise');
		await expect(row(page, 2)).toContainText('sine440-wav16-44k-stereo');
	});

	test('removing the pinned track leaves the list usable', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await expect(row(page, 0)).toContainText('pinknoise');
		await page.getByRole('button', { name: /^Remove pinknoise/ }).click();
		await expect(page.locator('ul li')).toHaveCount(1);
		await expect(row(page, 0)).toContainText('sine440');
		// the dangling pin must not pin anything else
		await expect(page.getByRole('button', { name: /^Unpin/ })).toHaveCount(0);
	});

	test('the pinned plot is excluded from the scrolling list', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await runAnalysis(page);
		// uppercase is CSS only — the text node stays lowercase
		await expect(page.getByTestId('pinned-plot')).toContainText('pinknoise');
		// exactly one plot per file overall: the pinned one is not drawn twice
		await expect(page.getByTestId('plot')).toHaveCount(2);
		await expect(page.getByTestId('plot-scroll').getByTestId('plot')).toHaveCount(1);
	});

	test('a track can be pinned from the analysis tab', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await runAnalysis(page);
		await expect(page.getByTestId('pinned-plot')).toHaveCount(0);

		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await expect(page.getByTestId('pinned-plot')).toContainText('pinknoise');
		// and unpinning from here puts it back in the scroll area
		await page.getByRole('button', { name: /^Unpin pinknoise/ }).click();
		await expect(page.getByTestId('pinned-plot')).toHaveCount(0);
		await expect(page.getByTestId('plot-scroll').getByTestId('plot')).toHaveCount(2);
	});

	test('the analysis header puts the artist next to the title', async ({ page }) => {
		test.slow();
		await seedProject(page, ['sine440-tagged-5s.mp3']);
		await runAnalysis(page);
		const title = page.getByText('Test Song', { exact: true });
		const artist = page.getByText('Test Artist', { exact: true });
		const t = (await title.boundingBox())!;
		const a = (await artist.boundingBox())!;
		expect(a.x).toBeGreaterThanOrEqual(t.x + t.width - 1);
		// sits right after the title, not pushed to the far right of the row
		expect(a.x - (t.x + t.width)).toBeLessThan(40);
	});

	test('the pin survives a reload', async ({ page }) => {
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await page.getByRole('button', { name: /^Pin pinknoise/ }).click();
		await page.waitForTimeout(500); // > 300ms save debounce
		await page.reload();
		await expect(row(page, 0)).toContainText('pinknoise');
	});
});
