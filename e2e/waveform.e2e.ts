import { test, expect } from '@playwright/test';
import { skipSplash, createProject, uploadFiles, runAnalysis } from './helpers';

const WAVE = 'path[fill="#333333"]';

test('fresh analysis draws the waveform', async ({ page }) => {
	await skipSplash(page);
	await createProject(page);
	await uploadFiles(page, 'sine440-flac-44k-stereo-5s.flac');
	await runAnalysis(page);
	await expect(page.locator(WAVE)).toHaveCount(1);
});

test('legacy results without a waveform re-enable Analyze', async ({ page }) => {
	await skipSplash(page);
	const id = await createProject(page);
	await uploadFiles(page, 'sine440-flac-44k-stereo-5s.flac');
	await runAnalysis(page);
	await page.waitForTimeout(1000); // results save is debounced

	// Rewrite results.json the way a pre-streaming build left it.
	await page.evaluate(async (projectId) => {
		const root = await navigator.storage.getDirectory();
		const dir = await (
			await (await root.getDirectoryHandle('malm')).getDirectoryHandle('projects')
		).getDirectoryHandle(projectId);
		const fh = await dir.getFileHandle('results.json');
		const data = JSON.parse(await (await fh.getFile()).text());
		for (const r of data) delete r.waveform;
		const w = await fh.createWritable();
		await w.write(JSON.stringify(data));
		await w.close();
	}, id);

	await page.goto(`/projects/${id}/analysis`);
	await expect(page.locator('svg').first()).toBeVisible();
	await expect(page.locator(WAVE)).toHaveCount(0);

	// Analyze must be offered again so the waveform can be regenerated.
	await page.goto(`/projects/${id}/setup`);
	const analyze = page.getByRole('button', { name: 'Analyze' });
	await expect(analyze).toBeEnabled();
	await analyze.click();
	await page.waitForURL(/\/analysis$/, { timeout: 120_000 });
	await expect(page.locator(WAVE)).toHaveCount(1);
});
