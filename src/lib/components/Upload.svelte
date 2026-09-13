<script lang="ts">
	import { onMount } from 'svelte';
	import { files, addFiles, removeFile, reorderFiles, pinnedFirst } from '$lib/state/files.svelte';
	import { options } from '$lib/state/options.svelte';
	import { AUDIO_ACCEPT, isIosLike } from '$lib/audio/formats';
	import { getStorageEstimate, requestPersistentStorage } from '$lib/storage/opfs';
	import { formatBytes } from '$lib/format';

	let inputEl: HTMLInputElement;
	let dragOver = $state(false);
	let loading = $state(false);
	let skipped = $state<string[]>([]);
	let error = $state<string | null>(null);

	// Quota confirmation: set when the incoming batch does not fit in the space
	// the browser reports as available.
	let pending = $state<{ list: File[]; needed: number; available: number } | null>(null);

	// iOS/iPadOS Safari greys out anything its UTI mapping doesn't recognise, so
	// there we omit `accept` and filter the selection ourselves.
	let accept = $state<string | undefined>(AUDIO_ACCEPT);
	onMount(() => {
		if (isIosLike()) accept = undefined;
	});

	// Display order: the pinned track first. Drag and drop still works on the
	// real positions in files.list.
	const ordered = $derived(pinnedFirst(files.list, options.pinnedFileId));
	const realIndex = (id: string) => files.list.findIndex((f) => f.id === id);

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

	async function availableBytes(): Promise<number> {
		const { usage, quota } = await getStorageEstimate();
		return Math.max(0, quota - usage);
	}

	async function handleFiles(fileList: FileList | File[]) {
		const list = Array.from(fileList);
		const needed = list.reduce((sum, f) => sum + f.size, 0);
		const available = await availableBytes();
		// 5 % headroom: the estimate is coarse and the manifest costs a little too.
		if (available > 0 && needed > available * 0.95) {
			pending = { list, needed, available };
			return;
		}
		await runUpload(list);
	}

	async function runUpload(list: File[]) {
		pending = null;
		loading = true;
		error = null;
		try {
			skipped = await addFiles(list);
		} catch (e) {
			error =
				e instanceof DOMException && e.name === 'QuotaExceededError'
					? 'Storage full — some files were not saved. Free space or delete a project.'
					: `Upload failed: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			loading = false;
		}
	}

	async function handlePersistThenUpload() {
		if (!pending) return;
		const list = pending.list;
		const needed = pending.needed;
		await requestPersistentStorage();
		const available = await availableBytes();
		if (needed > available * 0.95) {
			pending = { list, needed, available };
			return;
		}
		await runUpload(list);
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

	<!--
		Visually hidden rather than `hidden`/`display:none`: Safari refuses to open
		the picker for an input that isn't rendered.
	-->
	<input
		bind:this={inputEl}
		type="file"
		{accept}
		multiple
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		onchange={onInputChange}
	/>

	{#if error}
		<p class="mx-3 mb-2 text-xs text-danger-400">{error}</p>
	{/if}

	{#if skipped.length > 0}
		<p class="mx-3 mb-2 text-xs text-secondary-400">
			SKIPPED (UNSUPPORTED FORMAT): {skipped.join(', ')}
		</p>
	{/if}

	<!-- File list -->
	<ul class="min-h-0 overflow-y-auto">
		{#each ordered as f (f.id)}
			{@const i = realIndex(f.id)}
			{@const pinned = options.pinnedFileId === f.id}
			<li
				class="flex items-center gap-3 border-b border-gray-800 px-3 py-2 hover:bg-gray-900 {dragSrcIndex ===
				i
					? 'opacity-40'
					: ''} {pinned ? 'bg-gray-900' : ''}"
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

				<!-- pin -->
				<button
					class="shrink-0 {pinned ? 'text-secondary-400' : 'text-gray-700 hover:text-gray-400'}"
					onclick={() => (options.pinnedFileId = pinned ? null : f.id)}
					aria-label="{pinned ? 'Unpin' : 'Pin'} {f.name}"
				>
					<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
						<path d="M14 2l8 8-3 1-3 3-1 6-3-4-5 5-1 1 1-2 5-5-4-3 6-1 3-3z" />
					</svg>
				</button>

				<!-- remove -->
				<button
					class="shrink-0 text-xs text-gray-600 hover:text-secondary-400"
					onclick={() => removeFile(f.id)}
					aria-label="Remove {f.name}">✕</button
				>
			</li>
		{/each}
	</ul>

	<!-- Drop zone: below the tracks, filling whatever height is left -->
	<button
		type="button"
		class="m-3 flex min-h-24 flex-1 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed py-6 text-xs transition-colors {dragOver
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
</section>

<!-- Storage quota warning -->
{#if pending}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) pending = null;
		}}
	>
		<div class="w-full max-w-md border border-gray-700 bg-gray-900 p-6 shadow-2xl">
			<h2 class="mb-3 text-xs tracking-widest text-danger-400 uppercase">Not enough storage</h2>
			<p class="mb-3 text-sm text-gray-300">
				These files need <strong class="text-gray-100">{formatBytes(pending.needed)}</strong>, but
				only <strong class="text-gray-100">{formatBytes(pending.available)}</strong> is available.
			</p>
			<p class="mb-4 text-xs text-gray-500">
				The quota is set by the browser and no site can raise it. Freeing disk space, deleting other
				projects, or allowing more site data in the browser settings (Brave: Settings → Privacy →
				site data) can increase it. Requesting persistent storage only stops the browser evicting
				what is already stored.
			</p>
			<div class="flex flex-wrap justify-end gap-2">
				<button
					onclick={() => (pending = null)}
					class="border border-gray-700 px-4 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-gray-500 hover:text-gray-300"
					>Cancel</button
				>
				<button
					onclick={handlePersistThenUpload}
					class="border border-gray-700 px-4 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-secondary-400 hover:text-secondary-400"
					>Request persistent storage</button
				>
				<button
					onclick={() => runUpload(pending!.list)}
					class="bg-secondary-400 px-4 py-1.5 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300"
					>Upload anyway</button
				>
			</div>
		</div>
	</div>
{/if}
