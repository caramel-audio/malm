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

	test('appending a file only analyzes the new one', async ({ page }) => {
		test.slow();
		const id = await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
		await page.waitForTimeout(1000); // let the debounced results save reach OPFS

		// Fingerprint the stored result of the first file. Re-analyzing would
		// overwrite it with the real value, so if it survives it was reused.
		await page.evaluate(async (projectId) => {
			const root = await navigator.storage.getDirectory();
			const malm = await root.getDirectoryHandle('malm');
			const projects = await malm.getDirectoryHandle('projects');
			const dir = await projects.getDirectoryHandle(projectId);
			const handle = await dir.getFileHandle('results.json');
			const data = JSON.parse(await (await handle.getFile()).text());
			for (const band of data[0].bands) band.integrated = -33.3;
			const writable = await handle.createWritable();
			await writable.write(JSON.stringify(data));
			await writable.close();
		}, id);
		await page.reload();

		await page.getByRole('link', { name: 'Setup' }).first().click();
		await uploadFiles(page, SHORT_WAV2);
		await runAnalysis(page);

		await expect(page.getByText(/LUFS-I:/)).toHaveCount(2);
		await expect(page.getByText('LUFS-I: -33.3')).toBeVisible();
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
		// the busy overlay must clear once the redraw is done
		await expect(page.getByTestId('busy-overlay')).toHaveCount(0);
	});

	test('removing a file then re-analyzing drops its plot', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await runAnalysis(page);
		await expect(page.getByTestId('plot')).toHaveCount(2);

		await page.getByRole('link', { name: 'Setup' }).first().click();
		await page.getByRole('button', { name: /^Remove sine440/ }).click();
		await runAnalysis(page);

		await expect(page.getByTestId('plot')).toHaveCount(1);
		await expect(page.getByText('pinknoise-wav16-44k-stereo-5s')).toBeVisible();
	});

	test('cancelling analysis leaves the project analyzable', async ({ page }) => {
		test.slow();
		await seedProject(page, ['pinknoise-wav16-44k-stereo-60s.wav']);
		await page.getByRole('button', { name: 'Analyze' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
		await expect(page).toHaveURL(/\/setup$/);
		await expect(page.getByRole('button', { name: 'Analyze' })).toBeEnabled();
		// and a second attempt still works
		await runAnalysis(page);
		await expect(page.getByText(/LUFS-I:/)).toBeVisible();
	});

	test('the busy overlay is shown while plots redraw', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);

		// The overlay lives only for the blocking redraw, so watch for it with an
		// observer instead of racing it with a poll.
		await page.evaluate(() => {
			(window as unknown as { __sawOverlay: boolean }).__sawOverlay = false;
			new MutationObserver(() => {
				if (document.querySelector('[data-testid="busy-overlay"]')) {
					(window as unknown as { __sawOverlay: boolean }).__sawOverlay = true;
				}
			}).observe(document.body, { childList: true, subtree: true });
		});

		await page.getByRole('button', { name: '0–200 Hz' }).first().click();
		await expect(page.getByTestId('plot').first()).toBeVisible();
		expect(
			await page.evaluate(() => (window as unknown as { __sawOverlay: boolean }).__sawOverlay)
		).toBe(true);
		await expect(page.getByTestId('busy-overlay')).toHaveCount(0);
	});

	test('a steeper slope changes the measured band loudness', async ({ page }) => {
		test.slow();
		const readBandLufs = async () => {
			await page.getByRole('button', { name: '0–200 Hz' }).first().click();
			await page
				.getByTestId('plot')
				.first()
				.hover({ position: { x: 250, y: 80 } });
			return page
				.getByRole('region', { name: 'Transport' })
				.getByTestId('transport-lufs-m')
				.textContent();
		};

		await seedProject(page, ['whitenoise-wav16-48k-mono-5s.wav']);
		await runAnalysis(page);
		const lr24 = await readBandLufs();
		expect(lr24).not.toBe('—');

		await page.getByRole('link', { name: 'Setup' }).first().click();
		await page.getByRole('button', { name: 'BW 12 dB/oct' }).click();
		await runAnalysis(page);
		const bw12 = await readBandLufs();

		// A 12 dB/oct low band leaks far more broadband noise than a 24 dB/oct one
		expect(Number(bw12)).toBeGreaterThan(Number(lr24));
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
