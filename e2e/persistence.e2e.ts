import { test, expect } from '@playwright/test';
import {
	skipSplash,
	createProject,
	seedProject,
	runAnalysis,
	SHORT_WAV,
	TINY_WAV
} from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

test.describe('persistence', () => {
	test('files and options restored after reload', async ({ page }) => {
		await seedProject(page, [SHORT_WAV]);
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await page.waitForTimeout(700); // > save debounce
		await page.reload();
		await expect(page.locator('ul li')).toHaveCount(1, { timeout: 15_000 });
		await expect(page.locator('ul li').first()).toContainText('sine440');
		await expect(page.getByLabel('Crossover frequency in Hz')).toHaveCount(1);
	});

	test('hub card opens setup without results, analysis with results', async ({ page }) => {
		test.slow();
		await seedProject(page, [TINY_WAV], 'Redirect Test');
		// no results yet: card navigates to setup
		await page.goto('/projects');
		await page.getByRole('button', { name: /Redirect Test/ }).click();
		await page.waitForURL(/\/setup$/);
		await runAnalysis(page);
		await page.waitForTimeout(1000); // > results save debounce
		// with saved results: card navigates straight to analysis
		await page.goto('/projects');
		await page.getByRole('button', { name: /Redirect Test/ }).click();
		await page.waitForURL(/\/analysis$/);
		await expect(page.getByText(/LUFS-I:/)).toBeVisible({ timeout: 15_000 });
	});

	test('results survive reload', async ({ page }) => {
		test.slow();
		await seedProject(page, [TINY_WAV]);
		await runAnalysis(page);
		await page.waitForTimeout(1000);
		await page.reload();
		await expect(page.getByText(/LUFS-I:/)).toBeVisible({ timeout: 15_000 });
	});

	test('deleting project clears its stored options', async ({ page }) => {
		await skipSplash(page);
		const id = await createProject(page, 'To Delete');
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await page.waitForTimeout(700);
		await page.goto('/projects');
		await page.getByRole('button', { name: 'Delete project' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page.getByText('To Delete')).toHaveCount(0);
		const stored = await page.evaluate(
			(pid) => localStorage.getItem(`malm_project_${pid}_options`),
			id
		);
		expect(stored).toBeNull();
	});
});
