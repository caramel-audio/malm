// OPFS storage for audio files and large project data.
// Lightweight metadata (project list, options) lives in localStorage instead.

import type { FileResult } from '$lib/state/results.svelte';

export type AudioFileMeta = {
	id: string;
	name: string;
	artist: string;
	duration: number;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
};

async function getMalmDir(): Promise<FileSystemDirectoryHandle> {
	const root = await navigator.storage.getDirectory();
	return root.getDirectoryHandle('malm', { create: true });
}

async function getProjectsDir(): Promise<FileSystemDirectoryHandle> {
	const malm = await getMalmDir();
	return malm.getDirectoryHandle('projects', { create: true });
}

async function getProjectDir(projectId: string): Promise<FileSystemDirectoryHandle> {
	const projects = await getProjectsDir();
	return projects.getDirectoryHandle(projectId, { create: true });
}

async function getFilesDir(projectId: string): Promise<FileSystemDirectoryHandle> {
	const project = await getProjectDir(projectId);
	return project.getDirectoryHandle('files', { create: true });
}

async function readJsonFile<T>(
	dir: FileSystemDirectoryHandle,
	name: string
): Promise<T | null> {
	try {
		const fh = await dir.getFileHandle(name);
		const file = await fh.getFile();
		return JSON.parse(await file.text()) as T;
	} catch {
		return null;
	}
}

async function writeJsonFile(
	dir: FileSystemDirectoryHandle,
	name: string,
	data: unknown
): Promise<void> {
	const fh = await dir.getFileHandle(name, { create: true });
	const writable = await fh.createWritable();
	await writable.write(JSON.stringify(data));
	await writable.close();
}

// --- File manifest (ordered list of audio files) ---

export async function loadFileManifest(projectId: string): Promise<AudioFileMeta[]> {
	const dir = await getFilesDir(projectId);
	return (await readJsonFile<AudioFileMeta[]>(dir, 'manifest.json')) ?? [];
}

async function saveFileManifest(projectId: string, manifest: AudioFileMeta[]): Promise<void> {
	const dir = await getFilesDir(projectId);
	await writeJsonFile(dir, 'manifest.json', manifest);
}

export async function saveAudioFile(
	projectId: string,
	meta: AudioFileMeta,
	file: File
): Promise<void> {
	const dir = await getFilesDir(projectId);

	const fh = await dir.getFileHandle(meta.id, { create: true });
	const writable = await fh.createWritable();
	await writable.write(await file.arrayBuffer());
	await writable.close();

	const manifest = await loadFileManifest(projectId);
	const existing = manifest.findIndex((m) => m.id === meta.id);
	if (existing >= 0) manifest[existing] = meta;
	else manifest.push(meta);
	await saveFileManifest(projectId, manifest);
}

export async function removeAudioFile(projectId: string, fileId: string): Promise<void> {
	const dir = await getFilesDir(projectId);
	try {
		await dir.removeEntry(fileId);
	} catch {}
	const manifest = await loadFileManifest(projectId);
	await saveFileManifest(
		projectId,
		manifest.filter((m) => m.id !== fileId)
	);
}

export async function reorderAudioFiles(
	projectId: string,
	orderedIds: string[]
): Promise<void> {
	const manifest = await loadFileManifest(projectId);
	const byId = new Map(manifest.map((m) => [m.id, m]));
	const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as AudioFileMeta[];
	await saveFileManifest(projectId, reordered);
}

export async function loadAudioFiles(
	projectId: string
): Promise<{ meta: AudioFileMeta; arrayBuffer: ArrayBuffer }[]> {
	const dir = await getFilesDir(projectId);
	const manifest = await loadFileManifest(projectId);
	const results: { meta: AudioFileMeta; arrayBuffer: ArrayBuffer }[] = [];

	for (const meta of manifest) {
		try {
			const fh = await dir.getFileHandle(meta.id);
			const file = await fh.getFile();
			results.push({ meta, arrayBuffer: await file.arrayBuffer() });
		} catch {
			// Skip missing files
		}
	}
	return results;
}

// --- Results ---

export async function saveResults(projectId: string, data: FileResult[]): Promise<void> {
	const dir = await getProjectDir(projectId);
	await writeJsonFile(dir, 'results.json', data);
}

export async function loadResults(projectId: string): Promise<FileResult[] | null> {
	const dir = await getProjectDir(projectId);
	return readJsonFile<FileResult[]>(dir, 'results.json');
}

export async function clearResults(projectId: string): Promise<void> {
	const dir = await getProjectDir(projectId);
	try {
		await dir.removeEntry('results.json');
	} catch {}
}

// --- Delete entire project from OPFS ---

export async function deleteProjectFiles(projectId: string): Promise<void> {
	const projects = await getProjectsDir();
	try {
		await projects.removeEntry(projectId, { recursive: true });
	} catch {}
}

// --- Storage usage ---

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
	const estimate = await navigator.storage.estimate();
	return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
