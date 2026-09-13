import { test, expect } from '@playwright/test';
import { skipSplash, createProject, seedProject, runAnalysis, SHORT_WAV } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

const bar = (page: import('@playwright/test').Page) =>
	page.getByRole('region', { name: 'Transport' });

test.describe('transport bar', () => {
	test('is present on setup and analysis', async ({ page }) => {
		await skipSplash(page);
		const id = await createProject(page);
		await expect(bar(page)).toBeVisible();
		await page.goto(`/projects/${id}/analysis`);
		await expect(bar(page)).toBeVisible();
	});

	test('play starts the first track and shows elapsed time', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		await bar(page).getByRole('button', { name: 'Play' }).click();
		await expect(bar(page)).toContainText('sine440-wav16-44k-stereo-5s');
		await expect(bar(page).getByRole('button', { name: 'Pause' })).toBeVisible();
		await expect(bar(page).getByTestId('transport-time')).not.toHaveText('0:00 / 0:05');
	});

	test('spacebar toggles play and pause', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		await page.locator('body').press(' ');
		await expect(bar(page).getByRole('button', { name: 'Pause' })).toBeVisible();
		await page.locator('body').press(' ');
		await expect(bar(page).getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('skip forward and back move the playhead', async ({ page }) => {
		await seedProject(page, ['pinknoise-wav16-44k-stereo-60s.wav']);
		await bar(page).getByRole('button', { name: 'Play' }).click();
		await bar(page).getByRole('button', { name: 'Forward 10 seconds' }).click();
		await expect(bar(page).getByTestId('transport-time')).toContainText(/0:1[0-9]/);
		await bar(page).getByRole('button', { name: 'Back 10 seconds' }).click();
		await expect(bar(page).getByTestId('transport-time')).toContainText(/0:0[0-9]/);
		await bar(page).getByRole('button', { name: 'Back to start' }).click();
		await expect(bar(page).getByTestId('transport-time')).toContainText('0:00');
	});

	test('hovering a plot fills the LUFS readout, leaving clears it', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		const readout = bar(page).getByTestId('transport-lufs-m');
		await expect(readout).toHaveText('—');
		await page
			.getByTestId('plot')
			.first()
			.hover({ position: { x: 200, y: 80 } });
		await expect(readout).not.toHaveText('—');
		await page.getByRole('region', { name: 'Transport' }).hover();
		await expect(readout).toHaveText('—');
	});

	test('clicking a plot seeks and starts playback', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		await page
			.getByTestId('plot')
			.first()
			.click({ position: { x: 300, y: 80 } });
		await expect(bar(page).getByRole('button', { name: 'Pause' })).toBeVisible();
		await expect(page.locator('div.bg-white\\/40')).toBeVisible({ timeout: 10_000 });
	});

	test('plots no longer carry their own play button or inspect row', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		await expect(page.getByText('HOVER TO INSPECT')).toHaveCount(0);
		// the per-plot play triangle path is gone; the transport one is an <svg> in the bar
		await expect(page.locator('div.border-b button:has(svg path[d^="M5.25 5.653"])')).toHaveCount(
			0
		);
	});

	test('repeat restarts the track at the end', async ({ page }) => {
		await seedProject(page, ['sine440-wav16-44k-mono-0.5s.wav']);
		await bar(page).getByRole('button', { name: 'Repeat' }).click();
		await expect(bar(page).getByRole('button', { name: 'Repeat' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await bar(page).getByRole('button', { name: 'Play' }).click();
		// still playing well after the 0.5 s track would have ended
		await page.waitForTimeout(1500);
		await expect(bar(page).getByRole('button', { name: 'Pause' })).toBeVisible();
	});
});
