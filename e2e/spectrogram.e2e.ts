import { test, expect } from '@playwright/test';
import { seedProject, runAnalysis, SHORT_WAV, SHORT_WAV2 } from './helpers';

test.describe('spectrogram tab', () => {
	test('draws a spectrogram per track and reads out the frequency under the cursor', async ({
		page
	}) => {
		test.slow();
		await seedProject(page, [SHORT_WAV, SHORT_WAV2]);
		await runAnalysis(page);

		await page.getByRole('link', { name: 'Spectrogram' }).first().click();
		await expect(page.getByTestId('spectrogram')).toHaveCount(2);

		// Hover the top half of the first canvas: the readout names a frequency in
		// the upper part of the range, not a loudness.
		const canvas = page.getByTestId('spectrogram').first();
		const box = (await canvas.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.25);

		const readout = page.getByTestId('spectrogram-readout');
		await expect(readout).toBeVisible();
		await expect(readout).toContainText('Hz');

		// Moving down the canvas must report a lower frequency.
		const high = Number(await readout.getAttribute('data-hz'));
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
		const low = Number(await readout.getAttribute('data-hz'));
		expect(low).toBeLessThan(high);
	});

	test('keeps the spectrogram when only the crossovers change', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);

		await page.getByRole('link', { name: 'Setup' }).first().click();
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();

		// Loudness is now stale… (the notice is rendered twice: mobile bar + sidebar)
		const stale = page.getByTestId('stale-notice').filter({ visible: true });
		await page.getByRole('link', { name: 'LUFS' }).first().click();
		await expect(stale).toHaveCount(1);

		// …but the spectrogram does not depend on the crossovers, so it is not.
		await page.getByRole('link', { name: 'Spectrogram' }).first().click();
		await expect(page.getByTestId('spectrogram')).toBeVisible();
		await expect(stale).toHaveCount(0);
	});

	test('switches the frequency axis to log', async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);

		await page.getByRole('link', { name: 'Spectrogram' }).first().click();
		await expect(page.getByText('50', { exact: true })).toHaveCount(0);

		await page.getByRole('button', { name: 'Log', exact: true }).click();
		// Only the log axis has room for a tick down at 50 Hz.
		await expect(page.getByText('50', { exact: true }).first()).toBeVisible();
	});
});
