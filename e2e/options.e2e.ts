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

	test('slope defaults to LR24 and persists across reload', async ({ page }) => {
		const lr24 = page.getByRole('button', { name: 'LR 24 dB/oct' });
		const bw48 = page.getByRole('button', { name: 'BW 48 dB/oct' });
		await expect(lr24).toHaveAttribute('aria-pressed', 'true');
		await bw48.click();
		await expect(bw48).toHaveAttribute('aria-pressed', 'true');
		await page.waitForTimeout(500); // > 300ms save debounce
		await page.reload();
		await expect(page.getByRole('button', { name: 'BW 48 dB/oct' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('save a crossover and load it back after changing it', async ({ page }) => {
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await page.getByRole('button', { name: 'BW 12 dB/oct' }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByPlaceholder('Crossover name').fill('My split');
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		// change everything, then load the preset back
		await page.getByRole('button', { name: 'Reset' }).click();
		await expect(freqInputs(page)).toHaveCount(2);
		await page.getByRole('button', { name: 'Load' }).click();
		await page.getByRole('button', { name: /^My split/ }).click();
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('2000');
		await expect(page.getByRole('button', { name: 'BW 12 dB/oct' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('saving twice under one name overwrites, and delete removes it', async ({ page }) => {
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByPlaceholder('Crossover name').fill('Dupe');
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByPlaceholder('Crossover name').fill('Dupe');
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		await page.getByRole('button', { name: 'Load' }).click();
		await expect(page.getByRole('button', { name: /^Dupe/ })).toHaveCount(1);
		// the second save replaced the first: applying it gives the 2000 Hz split alone
		await page.getByRole('button', { name: /^Dupe/ }).click();
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('2000');

		await page.getByRole('button', { name: 'Load' }).click();
		await page.getByRole('button', { name: 'Delete Dupe' }).click();
		await expect(page.getByRole('button', { name: /^Dupe/ })).toHaveCount(0);
		await expect(page.getByText('No saved crossovers yet.')).toBeVisible();
	});

	test('saved presets and project crossovers are both shown as name + slope + bar', async ({
		page
	}) => {
		await page.getByRole('button', { name: 'BW 48 dB/oct' }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByPlaceholder('Crossover name').fill('Shown');
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();
		await page.waitForTimeout(500); // > 300ms option save debounce
		await createProject(page, 'Second');

		await page.getByRole('button', { name: 'Load' }).click();
		const saved = page.getByRole('button', { name: /^Shown/ });
		await expect(saved).toContainText('BW 48 dB/oct');
		await expect(saved.getByTestId('crossover-preview')).toBeVisible();

		const fromProject = page.getByRole('button', { name: /^Test Project/ });
		await expect(fromProject).toContainText('BW 48 dB/oct');
		await expect(fromProject.getByTestId('crossover-preview')).toBeVisible();
	});

	test('an unnamed preset still saves under a fallback name', async ({ page }) => {
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();
		await page.getByRole('button', { name: 'Load' }).click();
		await expect(page.getByRole('button', { name: /^Untitled/ })).toHaveCount(1);
	});

	test('loads crossovers from another project', async ({ page }) => {
		// project A keeps a single 5000 Hz split
		await page.getByRole('button', { name: 'Remove 200 Hz' }).click();
		const first = freqInputs(page).nth(0);
		await first.fill('5000');
		await first.press('Enter');
		await page.waitForTimeout(500); // > 300ms save debounce

		await createProject(page, 'Project B');
		await page.getByRole('button', { name: 'Load' }).click();
		await page.getByRole('button', { name: /Test Project/ }).click();
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('5000');
	});

	test('a new project inherits the last project crossovers', async ({ page }) => {
		await page.getByRole('button', { name: 'Remove 2000 Hz' }).click();
		await page.getByRole('button', { name: 'BW 48 dB/oct' }).click();
		await page.waitForTimeout(500); // > 300ms save debounce

		await createProject(page, 'Inheritor');
		await expect(freqInputs(page)).toHaveCount(1);
		await expect(freqInputs(page).nth(0)).toHaveValue('200');
		await expect(page.getByRole('button', { name: 'BW 48 dB/oct' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
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
