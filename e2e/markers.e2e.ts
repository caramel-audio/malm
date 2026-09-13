import { test, expect } from '@playwright/test';
import { seedProject, runAnalysis, SHORT_WAV } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

/** Right-click inside the plot area (x > left margin, y above the time axis). */
async function addMarker(page: import('@playwright/test').Page, x: number): Promise<void> {
	await page
		.getByTestId('plot')
		.first()
		.click({ button: 'right', position: { x, y: 60 } });
}

test.describe('sticky markers', () => {
	test.beforeEach(async ({ page }) => {
		test.slow();
		await seedProject(page, [SHORT_WAV]);
		await runAnalysis(page);
	});

	test('right-click adds a marker showing the LUFS value there', async ({ page }) => {
		await expect(page.getByTestId('marker')).toHaveCount(0);
		await addMarker(page, 200);
		await expect(page.getByTestId('marker')).toHaveCount(1);
		await expect(page.getByTestId('marker')).toContainText(/-\d+\.\d/);

		await addMarker(page, 300);
		await expect(page.getByTestId('marker')).toHaveCount(2);
	});

	test('the delete button only appears on hover and removes the marker', async ({ page }) => {
		await addMarker(page, 200);
		const remove = page.getByRole('button', { name: /^Remove marker at/ });
		await page.mouse.move(0, 0); // the right-click leaves the pointer on the new marker
		await expect(remove).toBeHidden();

		await page.getByTestId('marker').hover();
		await expect(remove).toBeVisible();
		await remove.click();
		await expect(page.getByTestId('marker')).toHaveCount(0);
	});

	test('markers survive a reload', async ({ page }) => {
		await addMarker(page, 200);
		const label = await page.getByTestId('marker').textContent();
		await page.waitForTimeout(500); // > 300ms save debounce
		await page.reload();
		await expect(page.getByTestId('plot').first()).toBeVisible({ timeout: 120_000 });
		await expect(page.getByTestId('marker')).toHaveCount(1);
		await expect(page.getByTestId('marker')).toHaveText(label!);
	});
});
