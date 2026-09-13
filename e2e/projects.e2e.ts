import { test, expect } from '@playwright/test';
import { skipSplash, createProject } from './helpers';

test.describe('splash screen', () => {
	test('shows on first visit, dismiss persists', async ({ page }) => {
		await page.goto('/projects');
		await expect(page.getByText('Multi audio loudness measurement')).toBeVisible();
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByText('Multi audio loudness measurement')).toBeHidden();
		await page.reload();
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
		await expect(page.getByText('Multi audio loudness measurement')).toBeHidden();
	});

	test('info button reopens modal', async ({ page }) => {
		await skipSplash(page);
		await page.goto('/projects');
		await page.getByRole('button', { name: 'About' }).click();
		await expect(page.getByText('Multi audio loudness measurement')).toBeVisible();
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByText('Multi audio loudness measurement')).toBeHidden();
	});
});

test.describe('storage', () => {
	test('the protect button reports what the browser decided', async ({ page }) => {
		await skipSplash(page);
		await page.goto('/projects');
		const protect = page.getByTestId('storage-protect');
		const state = page.getByTestId('storage-state');
		// the bar only appears once the async quota estimate resolves
		await expect(protect.or(state)).toBeVisible();
		// already-protected browsers show the state instead of the button
		if ((await protect.count()) === 0) {
			await expect(state).toHaveText('Protected');
			return;
		}
		await protect.click();
		const outcome = page.getByTestId('storage-outcome');
		await expect(outcome).toBeVisible();
		// whichever way it went, it must say the quota cannot be raised
		await expect(outcome).toContainText(/no site can raise/);
	});
});

test.describe('project hub', () => {
	test.beforeEach(async ({ page }) => skipSplash(page));

	test('/ redirects to /projects', async ({ page }) => {
		await page.goto('/');
		await page.waitForURL(/\/projects$/);
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
	});

	test('empty hub shows only New Project card', async ({ page }) => {
		await page.goto('/projects');
		await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Rename project' })).toHaveCount(0);
	});

	test('create project navigates to setup and shows card on hub', async ({ page, browserName }) => {
		const id = await createProject(page, 'My Album');
		expect(id).toBeTruthy();
		// Playwright WebKit has no OPFS — setup page shows a load error instead of the drop zone
		if (browserName !== 'webkit') {
			await expect(page.getByText('DROP AUDIO FILES HERE')).toBeVisible();
		}
		await page.goto('/projects');
		await expect(page.getByText('My Album')).toBeVisible();
	});

	test('rename project', async ({ page }) => {
		await createProject(page, 'Old Name');
		await page.goto('/projects');
		await page.getByRole('button', { name: 'Rename project' }).click();
		const input = page.locator('input:focus');
		await input.fill('New Name');
		await input.press('Enter');
		await expect(page.getByText('New Name')).toBeVisible();
		await expect(page.getByText('Old Name')).toHaveCount(0);
	});

	test('delete project with confirmation', async ({ page }) => {
		await createProject(page, 'Doomed');
		await page.goto('/projects');
		await page.getByRole('button', { name: 'Delete project' }).click();
		await expect(page.getByText('permanently removed')).toBeVisible();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page.getByText('Doomed')).toHaveCount(0);
	});

	test('delete cancel keeps project', async ({ page }) => {
		await createProject(page, 'Survivor');
		await page.goto('/projects');
		await page.getByRole('button', { name: 'Delete project' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByText('Survivor')).toBeVisible();
	});
});
