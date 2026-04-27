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

<section class="h-full flex flex-col">
	<div class="px-3 py-2 border-b border-gray-700 text-secondary-400 uppercase tracking-widest text-xs">
		FILES
	</div>

	<!-- Drop zone -->
	<button
		type="button"
		class="m-3 border border-dashed flex flex-col items-center justify-center gap-2 py-6 text-xs cursor-pointer transition-colors {dragOver
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
	<ul class="flex-1 overflow-y-auto">
		{#each files.list as f, i (f.id)}
			<li
				class="flex items-center gap-3 px-3 py-1.5 border-b border-gray-800 hover:bg-gray-900 {dragSrcIndex === i ? 'opacity-40' : ''}"
				draggable="true"
				ondragstart={(e) => onRowDragStart(e, i)}
				ondragover={onRowDragOver}
				ondrop={(e) => onRowDrop(e, i)}
				ondragend={onRowDragEnd}
			>
				<span class="text-gray-500 cursor-grab select-none">⠿</span>
				<span class="flex-1 truncate text-xs">{f.name}</span>
				{#if f.artist}
					<span class="text-gray-400 shrink-0 text-xs truncate max-w-24">{f.artist}</span>
				{/if}
				<span class="text-gray-400 shrink-0 tabular-nums text-xs">{formatDuration(f.duration)}</span>
				<button
					class="text-gray-400 hover:text-secondary-400 text-xs shrink-0"
					onclick={() => removeFile(f.id)}
					aria-label="Remove {f.name}"
				>✕</button>
			</li>
		{/each}
	</ul>
</section>
