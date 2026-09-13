import { defineConfig, devices } from '@playwright/test';

const desktop = { viewport: { width: 1440, height: 900 } };
// responsive.e2e.ts runs only on tablet/mobile; screenshot.e2e.ts only via --project=screenshot
const desktopIgnore = ['**/screenshot.e2e.ts', '**/responsive.e2e.ts'];
const smallMatch = ['**/responsive.e2e.ts', '**/projects.e2e.ts'];

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	globalSetup: './e2e/global-setup.ts',
	timeout: 60_000,
	// The full matrix (3 browsers + tablet + mobile, 5 workers, all sharing one
	// preview server) starves a test or two per run on a busy machine — a
	// different one each time, and always green on its own. Retried runs are
	// reported as "flaky", not hidden.
	retries: 1,
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: true
	},
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{
			name: 'chromium',
			testIgnore: desktopIgnore,
			use: { ...devices['Desktop Chrome'], ...desktop }
		},
		{
			name: 'firefox',
			testIgnore: desktopIgnore,
			use: { ...devices['Desktop Firefox'], ...desktop }
		},
		{
			name: 'webkit',
			testIgnore: desktopIgnore,
			use: { ...devices['Desktop Safari'], ...desktop }
		},
		{
			name: 'tablet',
			testMatch: smallMatch,
			use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true }
		},
		{ name: 'mobile', testMatch: smallMatch, use: { ...devices['Pixel 7'] } },
		{ name: 'screenshot', testMatch: '**/screenshot.e2e.ts', use: { ...devices['Desktop Chrome'] } }
	]
});
