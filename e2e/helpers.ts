import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export function fx(name: string): string {
	return path.join(dir, 'fixtures', name);
}

/** Suppress the first-visit splash modal. Call before the first goto. */
export async function skipSplash(page: Page): Promise<void> {
	await page.addInitScript(() => localStorage.setItem('malm_visited', '1'));
}

/** Create a project via the hub UI. Returns the project id. */
export async function createProject(page: Page, name = 'Test Project'): Promise<string> {
	await page.goto('/projects');
	await page.getByRole('button', { name: 'New Project' }).click();
	await page.getByPlaceholder('Project name').fill(name);
	await page.getByRole('button', { name: 'Create', exact: true }).click();
	await page.waitForURL(/\/projects\/[^/]+\/setup/);
	return page.url().match(/\/projects\/([^/]+)\/setup/)![1];
}

/** Upload fixture files via the hidden file input and wait for track rows. */
export async function uploadFiles(page: Page, ...names: string[]): Promise<void> {
	const before = await page.locator('ul li').count();
	await page.locator('input[type=file]').setInputFiles(names.map(fx));
	await expect(page.locator('ul li')).toHaveCount(before + names.length, { timeout: 30_000 });
	await expect(page.getByText('LOADING...')).toBeHidden();
}

/** Click Analyze and wait for the results plots. Callers should use test.slow(). */
export async function runAnalysis(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Analyze' }).click();
	await page.waitForURL(/\/analysis$/, { timeout: 120_000 });
	await expect(page.locator('svg').first()).toBeVisible({ timeout: 120_000 });
}

/** Full seed: project + files uploaded, on setup page. */
export async function seedProject(page: Page, files: string[], name?: string): Promise<string> {
	await skipSplash(page);
	const id = await createProject(page, name);
	await uploadFiles(page, ...files);
	return id;
}

export const SHORT_WAV = 'sine440-wav16-44k-stereo-5s.wav';
export const SHORT_WAV2 = 'pinknoise-wav16-44k-stereo-5s.wav';
export const TINY_WAV = 'sine440-wav16-44k-mono-0.5s.wav';
