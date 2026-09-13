import { test, expect } from '@playwright/test';
import { skipSplash, createProject } from './helpers';

// Playwright's WebKit has no working OPFS (navigator.storage.getDirectory throws
// UnknownError), so every project page fails to load — nothing here can run.
test.skip(({ browserName }) => browserName === 'webkit', 'OPFS unavailable in Playwright WebKit');

const freqInputs = (page: import('@playwright/test').Page) =>
	page.getByLabel('Crossover frequency in Hz');

test.describe('crossover options', () => {
	test.beforeEach(async ({ page }) => {
		await skipSplash(page);
		await createProject(page);
	});

	test('default crossovers are 200 and 2000 Hz', async ({ page }) => {
		await expect(freqInputs(page)).toHaveCount(2);
		await expect(freqInputs(page).nth(0)).toHaveValue('200');
		await expect(freqInputs(page).nth(1)).toHaveValue('2000');
	});

	test('edit crossover via input keeps list sorted', async ({ page }) => {
		const first = freqInputs(page).nth(0);
		await first.fill('5000');
		await first.press('Enter');
		await expect(freqInputs(page).nth(0)).toHaveValue('2000');
		await expect(freqInputs(page).nth(1)).toHaveValue('5000');
	});

	test('add crossover by clicking spectrum bar', async ({ page }) => {
		const bar = page.getByRole('slider', { name: /Frequency spectrum/ });
		await bar.click({ position: { x: 100, y: 8 } });
		await expect(freqInputs(page)).toHaveCount(3);
	});

	test('remove crossover via pill button', async ({ page }) => {
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('2000');
	});

	test('reset restores defaults', async ({ page }) => {
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await page.getByRole('button', { name: 'Reset' }).click();
		await expect(freqInputs(page)).toHaveCount(2);
		await expect(freqInputs(page).nth(0)).toHaveValue('200');
	});

	test('options persist across reload', async ({ page }) => {
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await expect(freqInputs(page)).toHaveCount(1);
		await page.waitForTimeout(500); // > 300ms save debounce
		await page.reload();
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('2000');
	});
});
