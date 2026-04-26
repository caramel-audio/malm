export type AudioFile = {
	id: string;
	file: File;
	name: string;
	artist: string;
	duration: number; // seconds
	buffer: AudioBuffer | null;
	bandBuffers: Record<string, AudioBuffer>;
};

export const files = $state<{ list: AudioFile[] }>({ list: [] });

function parseMetadata(file: File): { name: string; artist: string } {
	const base = file.name.replace(/\.[^.]+$/, '');
	const sep = base.indexOf(' - ');
	if (sep !== -1) {
		return { artist: base.slice(0, sep), name: base.slice(sep + 3) };
	}
	return { name: base, artist: '' };
}

export async function addFiles(fileList: FileList | File[]): Promise<void> {
	const ctx = new AudioContext();
	const items = Array.from(fileList);

	await Promise.all(
		items.map(async (file) => {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = await ctx.decodeAudioData(arrayBuffer);
			const { name, artist } = parseMetadata(file);
			files.list.push({
				id: crypto.randomUUID(),
				file,
				name,
				artist,
				duration: buffer.duration,
				buffer,
				bandBuffers: {}
			});
		})
	);

	ctx.close();
}

export function removeFile(id: string): void {
	const idx = files.list.findIndex((f) => f.id === id);
	if (idx !== -1) files.list.splice(idx, 1);
}

export function reorderFiles(from: number, to: number): void {
	if (from === to) return;
	const [item] = files.list.splice(from, 1);
	files.list.splice(to, 0, item);
}
