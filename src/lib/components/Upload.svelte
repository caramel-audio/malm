<script lang="ts">
	import { files, addFiles, removeFile, reorderFiles } from '$lib/state/files.svelte';

	let inputEl: HTMLInputElement;
	let dragOver = $state(false);
	let loading = $state(false);

	let dragSrcIndex = $state<number | null>(null);

	function formatDuration(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatSampleRate(hz: number | null): string {
		if (!hz) return '';
		return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz` : `${hz} Hz`;
	}

	function normalizeCodec(codec: string, file: File): string {
		const c = codec.trim().toUpperCase();
		if (c.includes('LAYER 3') || c === 'MP3') return 'MP3';
		if (c.includes('LAYER 2')) return 'MP2';
		if (c === 'AAC') return 'AAC';
		if (c === 'FLAC') return 'FLAC';
		if (c === 'ALAC') return 'ALAC';
		if (c.includes('PCM')) return 'WAV';
		if (c === 'VORBIS') return 'OGG';
		if (c === 'OPUS') return 'OPUS';
		if (c === 'AIFF') return 'AIFF';
		if (c) return c;
		// fallback: MIME type then file extension
		const m = file.type.toLowerCase();
		const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (m.includes('flac') || ext === 'flac') return 'FLAC';
		if (m.includes('mpeg') || m.includes('mp3') || ext === 'mp3') return 'MP3';
		if (m.includes('aac') || ext === 'aac') return 'AAC';
		if (m.includes('ogg') || ext === 'ogg') return 'OGG';
		if (m.includes('wav') || ext === 'wav') return 'WAV';
		if (m.includes('aiff') || ext === 'aiff' || ext === 'aif') return 'AIFF';
		if (m.includes('mp4') || ext === 'm4a') return 'M4A';
		if (ext === 'opus') return 'OPUS';
		return '';
	}

	function formatBitrate(kbps: number | null, codec: string, file: File): string {
		const parts: string[] = [];
		const norm = normalizeCodec(codec, file);
		if (norm) parts.push(norm);
		if (kbps) parts.push(`${kbps} kbps`);
		return parts.join(' · ');
	}

	async function handleFiles(fileList: FileList | File[]) {
		loading = true;
		await addFiles(fileList);
		loading = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function onInputChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files?.length) handleFiles(input.files);
		input.value = '';
	}

	// Row drag-to-reorder
	function onRowDragStart(e: DragEvent, index: number) {
		dragSrcIndex = index;
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onRowDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
	}

	function onRowDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragSrcIndex !== null && dragSrcIndex !== index) {
			reorderFiles(dragSrcIndex, index);
		}
		dragSrcIndex = null;
	}

	function onRowDragEnd() {
		dragSrcIndex = null;
	}
</script>

<section class="flex h-full flex-col">
	<div
		class="border-b border-gray-700 px-3 py-2 text-xs tracking-widest text-secondary-400 uppercase"
	>
		FILES
	</div>

	<!-- Drop zone -->
	<button
		type="button"
		class="m-3 flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed py-6 text-xs transition-colors {files
			.list.length === 0
			? 'flex-1'
			: ''} {dragOver
			? 'border-secondary-400 text-secondary-400'
			: 'border-gray-700 text-gray-400 hover:border-secondary-400 hover:text-secondary-400'}"
		ondrop={onDrop}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		onclick={() => inputEl.click()}
	>
		{#if loading}
			<span>LOADING...</span>
		{:else}
			<span>DROP AUDIO FILES HERE</span>
			<span>or <span class="underline">BROWSE</span></span>
		{/if}
	</button>

	<input
		bind:this={inputEl}
		type="file"
		accept="audio/*"
		multiple
		hidden
		onchange={onInputChange}
	/>

	<!-- File list -->
	<ul class="{files.list.length > 0 ? 'flex-1' : ''} overflow-y-auto">
		{#each files.list as f, i (f.id)}
			<li
				class="flex items-center gap-3 border-b border-gray-800 px-3 py-2 hover:bg-gray-900 {dragSrcIndex ===
				i
					? 'opacity-40'
					: ''}"
				draggable="true"
				ondragstart={(e) => onRowDragStart(e, i)}
				ondragover={onRowDragOver}
				ondrop={(e) => onRowDrop(e, i)}
				ondragend={onRowDragEnd}
			>
				<!-- drag handle -->
				<span class="shrink-0 cursor-grab text-gray-500 select-none">⠿</span>

				<!-- album art -->
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-gray-800"
				>
					{#if f.coverUrl}
						<img src={f.coverUrl} alt="" class="h-full w-full object-cover" draggable="false" />
					{:else}
						<svg
							class="h-5 w-5 text-gray-600"
							viewBox="0 0 24 24"
							fill="currentColor"
							aria-hidden="true"
						>
							<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
						</svg>
					{/if}
				</div>

				<!-- metadata -->
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs text-gray-100">{f.name}</div>
					<div class="mt-0.5 truncate text-xs text-gray-500">
						{#if f.artist || f.album}
							{[f.artist, f.album].filter(Boolean).join(' · ')}
						{:else}
							<span class="text-gray-700">—</span>
						{/if}
					</div>
				</div>

				<!-- technical info + duration -->
				<div class="shrink-0 text-right">
					<div class="text-xs text-gray-500 tabular-nums">
						{formatBitrate(f.bitrate, f.codec, f.file) || '—'}
					</div>
					<div class="mt-0.5 text-xs text-gray-400 tabular-nums">
						{#if f.sampleRate}
							<span class="text-gray-500">{formatSampleRate(f.sampleRate)}</span>
							<span class="mx-1 text-gray-700">·</span>
						{/if}
						{formatDuration(f.duration)}
					</div>
				</div>

				<!-- remove -->
				<button
					class="shrink-0 text-xs text-gray-600 hover:text-secondary-400"
					onclick={() => removeFile(f.id)}
					aria-label="Remove {f.name}">✕</button
				>
			</li>
		{/each}
	</ul>
</section>
