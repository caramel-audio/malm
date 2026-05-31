import { parseBlob, selectCover } from 'music-metadata';
import { saveAudioFile, removeAudioFile, reorderAudioFiles } from '$lib/storage/opfs';
import { updateProjectMeta } from '$lib/state/project.svelte';

export type AudioFile = {
	id: string;
	file: File;
	name: string;
	artist: string;
	album: string;
	duration: number; // seconds
	codec: string;
	bitrate: number | null; // kbps
	sampleRate: number | null; // Hz
	coverUrl: string | null; // ephemeral object URL
	buffer: AudioBuffer | null;
};

export const files = $state<{ list: AudioFile[] }>({ list: [] });

// Set by the project layout when a project is active.
export let currentProjectId: string | null = null;
export function setCurrentProjectId(id: string | null): void {
	currentProjectId = id;
}

// Reads sample rate from raw FLAC STREAMINFO block (bytes 18-20 of a standard fLaC file).
function flacSampleRate(buf: ArrayBuffer): number | null {
	if (buf.byteLength < 22) return null;
	const v = new DataView(buf);
	if (v.getUint32(0) !== 0x664c6143) return null; // "fLaC"
	const sr = (v.getUint8(18) << 12) | (v.getUint8(19) << 4) | (v.getUint8(20) >> 4);
	return sr > 0 ? sr : null;
}

export function sampleRateFromBuffer(buf: ArrayBuffer, mimeType: string, fileName: string): number | null {
	const m = mimeType.toLowerCase();
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	if (m.includes('flac') || ext === 'flac') return flacSampleRate(buf);
	return null;
}

function filenameFallback(file: File): { name: string; artist: string } {
	const base = file.name.replace(/\.[^.]+$/, '');
	const sep = base.indexOf(' - ');
	if (sep !== -1) {
		return { artist: base.slice(0, sep), name: base.slice(sep + 3) };
	}
	return { name: base, artist: '' };
}

async function extractMetadata(file: File): Promise<{
	name: string;
	artist: string;
	album: string;
	codec: string;
	bitrate: number | null;
	sampleRate: number | null;
	coverUrl: string | null;
}> {
	try {
		const meta = await parseBlob(file, { duration: false, skipCovers: false });
		const t = meta.common;
		const f = meta.format;

		const fallback = filenameFallback(file);
		const name = t.title?.trim() || fallback.name;
		const artist = t.artist?.trim() || fallback.artist;
		const album = t.album?.trim() || '';
		const codec = f.codec?.trim() || '';
		const bitrate = f.bitrate != null ? Math.round(f.bitrate / 1000) : null;
		const sampleRate = f.sampleRate ?? null;

		const pic = selectCover(t.picture ?? []);
		const coverUrl = pic ? URL.createObjectURL(new Blob([pic.data.buffer.slice(pic.data.byteOffset, pic.data.byteOffset + pic.data.byteLength) as ArrayBuffer], { type: pic.format })) : null;

		return { name, artist, album, codec, bitrate, sampleRate, coverUrl };
	} catch {
		const fallback = filenameFallback(file);
		return { ...fallback, album: '', codec: '', bitrate: null, sampleRate: null, coverUrl: null };
	}
}

export async function makeCoverUrl(
	arrayBuffer: ArrayBuffer,
	mimeType: string
): Promise<string | null> {
	try {
		const blob = new Blob([arrayBuffer], { type: mimeType });
		const meta = await parseBlob(blob, { duration: false, skipCovers: false });
		const pic = selectCover(meta.common.picture ?? []);
		return pic ? URL.createObjectURL(new Blob([pic.data.buffer.slice(pic.data.byteOffset, pic.data.byteOffset + pic.data.byteLength) as ArrayBuffer], { type: pic.format })) : null;
	} catch {
		return null;
	}
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
			const meta = await extractMetadata(file);
			const { name, artist, album, codec, bitrate, coverUrl } = meta;
			const sampleRate = meta.sampleRate ?? sampleRateFromBuffer(arrayBuffer, file.type, file.name);
			const id = crypto.randomUUID();

			files.list.push({
				id,
				file,
				name,
				artist,
				album,
				duration: buffer.duration,
				codec,
				bitrate,
				sampleRate,
				coverUrl,
				buffer
			});

			if (currentProjectId) {
				await saveAudioFile(
					currentProjectId,
					{
						id,
						name,
						artist,
						album,
						duration: buffer.duration,
						fileName: file.name,
						mimeType: file.type || 'audio/mpeg',
						sizeBytes: file.size,
						codec,
						bitrate,
						sampleRate
					},
					file
				);

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
		const [removed] = files.list.splice(idx, 1);
		if (removed.coverUrl) URL.revokeObjectURL(removed.coverUrl);

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
