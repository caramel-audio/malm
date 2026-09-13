import { test, expect } from '@playwright/test';
import { seedProject, runAnalysis, TINY_WAV } from './helpers';

// Runs on the tablet (820px) and mobile (Pixel 7, ~412px) projects only.
// Tailwind sm breakpoint is 640px: tablet gets desktop layout, mobile the stacked one.

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

test('project hub fits viewport', async ({ page }) => {
	await seedProject(page, []);
	await page.goto('/projects');
	await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();
	await noHorizontalOverflow(page);
});

test('setup page: nav tabs usable, no overflow', async ({ page }) => {
	await seedProject(page, [TINY_WAV]);
	await noHorizontalOverflow(page);
	// Desktop tab row on sm+, dedicated second row below sm — getByRole only sees the
	// rendered one, so exactly one Analysis tab is visible and clickable either way
	const tab = page.getByRole('link', { name: 'Analysis' });
	await expect(tab).toHaveCount(1);
	await tab.click();
	await page.waitForURL(/\/analysis$/);
	await expect(page.getByText('Press Analyze to start')).toBeVisible();
});

test('upload, analyze and view results, no overflow', async ({ page }) => {
	test.slow();
	const isMobile = (page.viewportSize()?.width ?? 9999) < 640;
	await seedProject(page, [TINY_WAV]);
	await runAnalysis(page);
	await expect(page.getByText(/LUFS-I:/)).toBeVisible();
	// Band selector renders in top bar (mobile) or sidebar (sm+)
	await expect(page.getByRole('button', { name: 'Momentary' }).locator('visible=true')).toHaveCount(
		1
	);
	if (isMobile) {
		await expect(page.getByText('Band').locator('visible=true')).toBeVisible();
	}
	await noHorizontalOverflow(page);
});
