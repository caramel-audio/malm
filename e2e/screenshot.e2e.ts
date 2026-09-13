import { test } from '@playwright/test';
import {
	skipSplash,
	createProject,
	uploadFiles,
	runAnalysis,
	SHORT_WAV,
	SHORT_WAV2
} from './helpers';

/**
 * Screenshot driver for development (used by Claude Code). Not part of the normal suite.
 *
 *   SHOT_ROUTE=/projects npx playwright test --project=screenshot
 *   SHOT_SEED=analysis SHOT_ROUTE='/projects/[id]/analysis' npx playwright test --project=screenshot
 *
 * Env vars:
 *   SHOT_ROUTE     route to capture, '[id]' replaced with the seeded project id (default /projects)
 *   SHOT_VIEWPORT  WxH, e.g. 390x844 (default project viewport)
 *   SHOT_SEED      'files' seeds a project with two tracks; 'analysis' also runs analysis
 *   SHOT_FILES     comma-separated fixture names to seed instead of the default two
 *   SHOT_SPLASH    set to show the first-visit splash instead of suppressing it
 *   SHOT_CLICK     accessible name of a button to click before the shot (e.g. to open a modal)
 *   SHOT_OUT       output path (default e2e/.shots/shot.png)
 */
test('screenshot', async ({ page }) => {
	test.skip(
		!process.env.SHOT_ROUTE && !process.env.SHOT_SEED,
		'screenshot driver — set SHOT_* env vars and run with --project=screenshot'
	);
	test.slow();
	let route = process.env.SHOT_ROUTE ?? '/projects';

	if (process.env.SHOT_VIEWPORT) {
		const [w, h] = process.env.SHOT_VIEWPORT.split('x').map(Number);
		await page.setViewportSize({ width: w, height: h });
	}
	if (!process.env.SHOT_SPLASH) await skipSplash(page);

	if (process.env.SHOT_SEED) {
		const id = await createProject(page, 'Screenshot Project');
		const seedFiles = process.env.SHOT_FILES?.split(',') ?? [SHORT_WAV, SHORT_WAV2];
		await uploadFiles(page, ...seedFiles);
		if (process.env.SHOT_SEED === 'analysis') {
			await runAnalysis(page);
			await page.waitForTimeout(1000); // let the debounced results save hit OPFS before reload
		}
		route = route.replace('[id]', id);
	}

	await page.goto(route);
	await page.waitForLoadState('networkidle');
	if (process.env.SHOT_CLICK) {
		await page.getByRole('button', { name: process.env.SHOT_CLICK }).first().click();
	}
	await page.waitForTimeout(500); // let plots/fonts settle
	await page.screenshot({ path: process.env.SHOT_OUT ?? 'e2e/.shots/shot.png', fullPage: true });
});
