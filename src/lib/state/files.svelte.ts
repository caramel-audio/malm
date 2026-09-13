import { parseBlob, selectCover } from 'music-metadata';
import { saveAudioFile, removeAudioFile, reorderAudioFiles } from '$lib/storage/opfs';
import { updateProjectMeta } from '$lib/state/project.svelte';
import { isLikelyAudioFile, mimeTypeFor } from '$lib/audio/formats';
import { probeAudio } from '$lib/audio/decode';

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

export function sampleRateFromBuffer(
	buf: ArrayBuffer,
	mimeType: string,
	fileName: string
): number | null {
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

/**
 * `withDuration` makes music-metadata scan far enough to report a duration
 * (needed at upload time). Project load skips it — the duration is already in
 * the manifest and scanning a multi-hour file back out of OPFS is wasteful.
 */
export async function extractMetadata(
	file: File,
	withDuration = false
): Promise<{
	name: string;
	artist: string;
	album: string;
	codec: string;
	bitrate: number | null;
	sampleRate: number | null;
	duration: number | null;
	coverUrl: string | null;
}> {
	try {
		const meta = await parseBlob(file, { duration: withDuration, skipCovers: false });
		const t = meta.common;
		const f = meta.format;

		const fallback = filenameFallback(file);
		const name = t.title?.trim() || fallback.name;
		const artist = t.artist?.trim() || fallback.artist;
		const album = t.album?.trim() || '';
		const codec = f.codec?.trim() || '';
		const bitrate = f.bitrate != null ? Math.round(f.bitrate / 1000) : null;
		const sampleRate = f.sampleRate ?? null;
		const duration = f.duration ?? null;

		// selectCover throws on an empty array (reduce without initial value)
		const pic = t.picture?.length ? selectCover(t.picture) : null;
		const coverUrl = pic
			? URL.createObjectURL(
					new Blob(
						[
							pic.data.buffer.slice(
								pic.data.byteOffset,
								pic.data.byteOffset + pic.data.byteLength
							) as ArrayBuffer
						],
						{ type: pic.format }
					)
				)
			: null;

		return { name, artist, album, codec, bitrate, sampleRate, duration, coverUrl };
	} catch {
		const fallback = filenameFallback(file);
		return {
			...fallback,
			album: '',
			codec: '',
			bitrate: null,
			sampleRate: null,
			duration: null,
			coverUrl: null
		};
	}
}

function totalSizeBytes(): number {
	return files.list.reduce((sum, f) => sum + f.file.size, 0);
}

/**
 * Adds every usable file and returns the names of the ones that were skipped
 * (not audio, unreadable, or in a format this browser cannot decode) so the UI
 * can report them instead of the whole batch failing.
 */
export async function addFiles(fileList: FileList | File[]): Promise<string[]> {
	const skipped: string[] = [];
	const items = Array.from(fileList).filter((file) => {
		if (isLikelyAudioFile(file)) return true;
		skipped.push(file.name);
		return false;
	});

	// Sequential, not Promise.all: saveAudioFile read-modify-writes the shared
	// manifest, so parallel adds lose entries. It also keeps the row order of a
	// multi-file drop equal to the selection order.
	for (const file of items) {
		try {
			// No decode here — a multi-hour track would blow up memory. Metadata
			// only; the analysis pass streams the audio when it needs it.
			const meta = await extractMetadata(file, true);
			const { name, artist, album, codec, bitrate, coverUrl } = meta;

			const header = await file.slice(0, 22).arrayBuffer();
			let sampleRate =
				meta.sampleRate ?? sampleRateFromBuffer(header, mimeTypeFor(file), file.name);
			let duration = meta.duration;

			if (duration == null || sampleRate == null) {
				// iCloud-backed files can fail to read, and some formats hide their
				// duration from the tag parser — fall back to a demuxer probe.
				const probe = await probeAudio(file);
				duration ??= probe?.duration ?? null;
				sampleRate ??= probe?.sampleRate ?? null;
			}
			if (duration == null) throw new Error('undecodable');

			const id = crypto.randomUUID();

			files.list.push({
				id,
				file,
				name,
				artist,
				album,
				duration,
				codec,
				bitrate,
				sampleRate,
				coverUrl
			});

			if (currentProjectId) {
				await saveAudioFile(
					currentProjectId,
					{
						id,
						name,
						artist,
						album,
						duration,
						fileName: file.name,
						mimeType: mimeTypeFor(file) || 'audio/mpeg',
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
		} catch (e) {
			// Running out of storage affects the whole batch — let it propagate.
			if (e instanceof DOMException && e.name === 'QuotaExceededError') throw e;
			// One bad file must not abort the rest of the batch.
			skipped.push(file.name);
		}
	}

	return skipped;
}

/** The pinned track first, everything else in its usual order. */
export function pinnedFirst(list: AudioFile[], pinnedId: string | null): AudioFile[] {
	if (!pinnedId) return list;
	const pinned = list.find((f) => f.id === pinnedId);
	return pinned ? [pinned, ...list.filter((f) => f.id !== pinnedId)] : list;
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
		reorderAudioFiles(
			currentProjectId,
			files.list.map((f) => f.id)
		);
	}
}
