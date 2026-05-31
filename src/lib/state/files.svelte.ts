import { saveAudioFile, removeAudioFile, reorderAudioFiles } from '$lib/storage/opfs';
import { updateProjectMeta } from '$lib/state/project.svelte';

export type AudioFile = {
	id: string;
	file: File;
	name: string;
	artist: string;
	duration: number; // seconds
	buffer: AudioBuffer | null;
};

export const files = $state<{ list: AudioFile[] }>({ list: [] });

// Set by the project layout when a project is active.
export let currentProjectId: string | null = null;
export function setCurrentProjectId(id: string | null): void {
	currentProjectId = id;
}

function parseMetadata(file: File): { name: string; artist: string } {
	const base = file.name.replace(/\.[^.]+$/, '');
	const sep = base.indexOf(' - ');
	if (sep !== -1) {
		return { artist: base.slice(0, sep), name: base.slice(sep + 3) };
	}
	return { name: base, artist: '' };
}

function totalSizeBytes(): number {
	return files.list.reduce((sum, f) => sum + f.file.size, 0);
}

export async function addFiles(fileList: FileList | File[]): Promise<void> {
	const ctx = new AudioContext();
	const items = Array.from(fileList);

	await Promise.all(
		items.map(async (file) => {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
			const { name, artist } = parseMetadata(file);
			const id = crypto.randomUUID();

			files.list.push({ id, file, name, artist, duration: buffer.duration, buffer });

			if (currentProjectId) {
				await saveAudioFile(currentProjectId, {
					id,
					name,
					artist,
					duration: buffer.duration,
					fileName: file.name,
					mimeType: file.type || 'audio/mpeg',
					sizeBytes: file.size
				}, file);

				updateProjectMeta(currentProjectId, {
					fileCount: files.list.length,
					fileSizeBytes: totalSizeBytes(),
					updatedAt: Date.now()
				});
			}
		})
	);

	ctx.close();
}

export function removeFile(id: string): void {
	const idx = files.list.findIndex((f) => f.id === id);
	if (idx !== -1) {
		files.list.splice(idx, 1);

		if (currentProjectId) {
			removeAudioFile(currentProjectId, id);
			updateProjectMeta(currentProjectId, {
				fileCount: files.list.length,
				fileSizeBytes: totalSizeBytes(),
				updatedAt: Date.now()
			});
		}
	}
}

export function reorderFiles(from: number, to: number): void {
	if (from === to) return;
	const [item] = files.list.splice(from, 1);
	files.list.splice(to, 0, item);

	if (currentProjectId) {
		reorderAudioFiles(currentProjectId, files.list.map((f) => f.id));
	}
}
