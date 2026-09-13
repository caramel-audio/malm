import { expect, test } from '@playwright/test';

// WebKit is the engine behind Safari on iPad, where the file picker greyed out
// every audio file. The native picker itself can't be automated, but its
// filtering is driven entirely by the input's `accept` attribute, so that is
// what these tests pin down.
test.use({ browserName: 'webkit' });

/** Minimal 8-bit mono PCM WAV, long enough to decode. */
function wavBytes(samples = 4410): Buffer {
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + samples, 4);
	header.write('WAVE', 8);
	header.write('fmt ', 12);
	header.writeUInt32LE(16, 16); // fmt chunk size
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // mono
	header.writeUInt32LE(44100, 24);
	header.writeUInt32LE(44100, 28); // byte rate
	header.writeUInt16LE(1, 32); // block align
	header.writeUInt16LE(8, 34); // bits per sample
	header.write('data', 36);
	header.writeUInt32LE(samples, 40);
	const data = Buffer.alloc(samples, 128); // silence
	return Buffer.concat([header, data]);
}

async function openNewProject(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/projects');
	await page.addInitScript(() => localStorage.setItem('malm_visited', '1'));
	await page.reload();
	await page.getByRole('button', { name: 'New Project' }).click();
	await page.getByRole('button', { name: 'Create' }).click();
	await page.waitForURL('**/setup');
}

test('file input does not restrict the OS picker', async ({ page }) => {
	await openNewProject(page);

	// Any `accept` list makes iOS/iPadOS grey out files it cannot map to a UTI —
	// that goes for the add-tracks input and the replace-track one alike.
	// .all() does not wait, so pin the multiple input down first.
	await expect(page.locator('input[type="file"][multiple]')).toHaveCount(1);
	for (const input of await page.locator('input[type="file"]').all()) {
		expect(await input.getAttribute('accept')).toBeNull();
		expect(await input.getAttribute('capture')).toBeNull();
	}
});

test('file input is rendered, not display:none, so Safari opens the picker', async ({ page }) => {
	await openNewProject(page);

	const display = await page
		.locator('input[type="file"][multiple]')
		.evaluate((el) => getComputedStyle(el).display);
	expect(display).not.toBe('none');
});

test('accepts an audio file the picker hands over without a MIME type', async ({ page }) => {
	await openNewProject(page);

	// iOS hands over files from iCloud/Files with an empty MIME type.
	await page.locator('input[type="file"][multiple]').setInputFiles({
		name: 'track.wav',
		mimeType: '',
		buffer: wavBytes()
	});

	await expect(page.getByRole('button', { name: 'Remove track' })).toBeVisible();
});

test('reports unsupported files instead of failing the whole selection', async ({ page }) => {
	await openNewProject(page);

	await page.locator('input[type="file"][multiple]').setInputFiles([
		{ name: 'track.wav', mimeType: '', buffer: wavBytes() },
		{ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }
	]);

	await expect(page.getByText(/SKIPPED/)).toContainText('notes.pdf');
	await expect(page.getByRole('button', { name: 'Remove track' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Remove notes' })).toHaveCount(0);
});
