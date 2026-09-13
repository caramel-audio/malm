import { test, expect } from '@playwright/test';
import {
	skipSplash,
	createProject,
	seedProject,
	uploadFiles,
	runAnalysis,
	SHORT_WAV,
	SHORT_WAV2,
	TINY_WAV
} from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

const transportBar = (page: import('@playwright/test').Page) =>
	page.getByRole('region', { name: 'Transport' });

test.describe('analysis', () => {
	test('analyze two files produces plots with LUFS values', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await runAnalysis(page);
		await expect(page.getByText(/LUFS-I:/)).toHaveCount(2);
	});

	test('Analyze disabled without files', async ({ page }) => {
		await skipSplash(page);
		await createProject(page);
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();
		await expect(page.getByText('No files loaded')).toBeVisible();
	});

	test('Analyze disabled when results fresh, re-enabled on change', async ({ page }) => {
		test.slow();
		await seedProject(page, [TINY_WAV]);
		await runAnalysis(page);
		await page.getByRole('link', { name: 'Setup' }).first().click();
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();
		await expect(page.getByText('Already analyzed')).toBeVisible();
		await uploadFiles(page, SHORT_WAV);
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
	});

	test('changing the filter slope invalidates results', async ({ page }) => {
		test.slow();
		await seedProject(page, [TINY_WAV]);
		await runAnalysis(page);
		await page.getByRole('link', { name: 'Setup' }).first().click();
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeDisabled();
		await page.getByRole('button', { name: 'LR 12 dB/oct' }).click();
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
		await runAnalysis(page);
		await expect(page.getByText(/LUFS-I:/)).toBeVisible();
	});

	test('band and loudness selectors switch without breaking plots', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		// default crossovers 200/2000 → bands: 0–200 Hz, 200–2000 Hz, 2000+ Hz, Full
		await page.getByRole('button', { name: '0–200 Hz' }).first().click();
		await expect(page.getByTestId('plot').first()).toBeVisible();
		await page.getByRole('button', { name: '2000+ Hz' }).first().click();
		await page.getByRole('button', { name: 'Short-term' }).first().click();
		await expect(page.getByTestId('plot').first()).toBeVisible();
		await expect(page.getByText(/LUFS-I:/)).toBeVisible();
	});

	test('normalize to quietest shows gain offset', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await runAnalysis(page);
		await page.getByRole('button', { name: 'To quietest' }).first().click();
		// louder file gets a negative dB offset chip in its plot header
		await expect(page.getByText(/-\d+(\.\d+)? dB/).first()).toBeVisible();
		await page.getByRole('button', { name: 'Off', exact: true }).first().click();
		await expect(page.getByText(/-\d+(\.\d+)? dB/)).toHaveCount(0);
	});

	test('playback shows playhead and pauses', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		await transportBar(page).getByRole('button', { name: 'Play' }).click();
		await expect(page.locator('div.bg-white\\/40')).toBeVisible({ timeout: 10_000 });
		await transportBar(page).getByRole('button', { name: 'Pause' }).click();
		await expect(transportBar(page).getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('silence analyzes without crashing', async ({ page }) => {
		test.slow();
		await seedProject(page, ['silence-wav16-44k-stereo-5s.wav']);
		await runAnalysis(page);
		await expect(page.getByTestId('plot').first()).toBeVisible();
		// -Infinity integrated loudness → LUFS-I chip hidden, but no error page
		await expect(page.getByText(/LUFS-I:/)).toHaveCount(0);
	});

	test('60 second file analyzes end to end', async ({ page }) => {
		test.slow();
		await seedProject(page, ['pinknoise-wav16-44k-stereo-60s.wav']);
		await runAnalysis(page);
		await expect(page.getByText(/LUFS-I:/)).toBeVisible();
		await expect(page.getByText('1:00').first()).toBeVisible();
	});
});
