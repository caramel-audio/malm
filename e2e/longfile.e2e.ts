// Opt-in long-track test: LONGFILE=1 npx playwright test longfile --project=chromium
// Verifies a multi-hour file uploads, analyses, and plots without the heap
// growing to full-PCM size. Skipped by default (needs ffmpeg and ~20 minutes).

import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOURS = Number(process.env.LONGFILE_HOURS ?? 3);
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FIXTURE = join(FIXTURE_DIR, `long-${HOURS}h.flac`);
const HEAP_LIMIT = 1.5 * 1024 * 1024 * 1024;

test.skip(!process.env.LONGFILE, 'set LONGFILE=1 to run');
test.setTimeout(20 * 60_000);

test.beforeAll(() => {
	if (existsSync(FIXTURE)) return;
	mkdirSync(FIXTURE_DIR, { recursive: true });
	execSync(
		`ffmpeg -y -f lavfi -i "sine=frequency=440:sample_rate=44100" -ac 2 -t ${HOURS * 3600} "${FIXTURE}"`,
		{ stdio: 'inherit', timeout: 15 * 60_000 }
	);
});

test('analyses a multi-hour track without loading it all into memory', async ({
	page,
	browserName
}) => {
	await page.goto('/projects');
	// The splash screen covers the page on a first visit.
	const close = page.getByRole('button', { name: 'Close' });
	if (await close.isVisible()) await close.click();
	await page.getByRole('button', { name: 'New Project' }).click();
	await page.getByRole('button', { name: 'Create' }).click();
	await expect(page).toHaveURL(/\/projects\/[^/]+\/setup/);

	await page.locator('input[type="file"]').setInputFiles(FIXTURE);

	// Duration column shows h:mm:ss-ish minutes — 3 h is 180 minutes.
	const row = page.locator('ul li').first();
	await expect(row).toBeVisible({ timeout: 5 * 60_000 });
	await expect(row).toContainText(`${HOURS * 60}:`, { timeout: 5 * 60_000 });

	// Chromium-only heap sampling while the analysis runs.
	let peakHeap = 0;
	let polling = true;
	const poll = (async () => {
		if (browserName !== 'chromium') return;
		const client = await page.context().newCDPSession(page);
		await client.send('Performance.enable');
		while (polling) {
			const { metrics } = await client.send('Performance.getMetrics');
			const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
			if (heap > peakHeap) peakHeap = heap;
			await new Promise((r) => setTimeout(r, 2000));
		}
	})();

	await page.getByRole('button', { name: 'Analyze' }).click();
	await expect(page).toHaveURL(/\/analysis$/, { timeout: 18 * 60_000 });
	polling = false;
	await poll;

	await expect(page.getByTestId('plot').first()).toBeVisible();
	if (browserName === 'chromium') expect(peakHeap).toBeLessThan(HEAP_LIMIT);
});
