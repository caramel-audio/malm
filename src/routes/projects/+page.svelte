<script lang="ts">
	import { goto } from '$app/navigation';
	import { projects, createProject, deleteProject, renameProject } from '$lib/state/project.svelte';
	import { getStorageEstimate } from '$lib/storage/opfs';
	import type { ProjectMeta } from '$lib/state/project.svelte';
	import { onMount, tick } from 'svelte';

	let showNewModal = $state(false);
	let newName = $state('Untitled Project');
	let newNameInput: HTMLInputElement | undefined = $state();

	let editingId = $state<string | null>(null);
	let editingName = $state('');
	let editingInput: HTMLInputElement | undefined = $state();
	let deleteConfirmId = $state<string | null>(null);

	let storageUsage = $state(0);
	let storageQuota = $state(0);

	onMount(async () => {
		const est = await getStorageEstimate();
		storageUsage = est.usage;
		storageQuota = est.quota;
	});

	function formatBytes(bytes: number): string {
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	function formatRelativeTime(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days}d ago`;
		return new Date(ts).toLocaleDateString();
	}

	async function handleCreate() {
		const project = createProject(newName);
		showNewModal = false;
		newName = 'Untitled Project';
		goto(`/projects/${project.id}/setup`);
	}

	function openNewModal() {
		newName = 'Untitled Project';
		showNewModal = true;
		tick().then(() => { newNameInput?.focus(); newNameInput?.select(); });
	}

	function startEdit(p: ProjectMeta) {
		editingId = p.id;
		editingName = p.name;
		tick().then(() => editingInput?.focus());
	}

	function commitEdit() {
		if (editingId) renameProject(editingId, editingName);
		editingId = null;
	}

	async function confirmDelete(id: string) {
		deleteConfirmId = null;
		await deleteProject(id);
		const est = await getStorageEstimate();
		storageUsage = est.usage;
		storageQuota = est.quota;
	}

	const usageFraction = $derived(storageQuota > 0 ? Math.min(storageUsage / storageQuota, 1) : 0);
</script>

<div class="flex flex-col h-full overflow-y-auto">
	<!-- Card grid -->
	<div class="flex-1 p-4 sm:p-6">
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

			<!-- New Project card -->
			<button
				onclick={openNewModal}
				class="border border-secondary-400 bg-secondary-400 hover:bg-secondary-300 transition-colors flex items-center justify-center min-h-[80px] text-gray-950 font-bold text-xs uppercase tracking-widest gap-2"
			>
				<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" class="w-4 h-4">
					<path d="M8 2v12M2 8h12"/>
				</svg>
				New Project
			</button>

			<!-- Existing project cards -->
			{#each projects.list as p (p.id)}
				<div class="border border-gray-700 bg-gray-900 hover:border-gray-600 transition-colors relative">

					{#if editingId === p.id}
						<!-- Rename mode -->
						<div class="p-4">
							<input
								bind:this={editingInput}
								bind:value={editingName}
								onblur={commitEdit}
								onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') editingId = null; }}
								class="w-full bg-gray-800 border border-secondary-400 text-gray-100 text-sm font-bold px-2 py-0.5 focus:outline-none"
							/>
						</div>
					{:else}
						<!-- Normal mode: clickable card body -->
						<button
							class="w-full text-left p-4 flex flex-col gap-2 pr-16"
							onclick={() => goto(`/projects/${p.id}/setup`)}
						>
							<span class="font-bold text-sm text-gray-100 truncate">{p.name}</span>
							<div class="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
								<span>{formatRelativeTime(p.updatedAt)}</span>
								{#if p.fileCount > 0}
									<span>·</span>
									<span>{p.fileCount} {p.fileCount === 1 ? 'file' : 'files'}</span>
								{/if}
								{#if p.fileSizeBytes > 0}
									<span>·</span>
									<span>{formatBytes(p.fileSizeBytes)}</span>
								{/if}
							</div>
						</button>

						<!-- Pencil + Trash buttons -->
						<div class="absolute top-0 right-0 bottom-0 flex items-center gap-0 border-l border-gray-700">
							<button
								onclick={(e) => { e.stopPropagation(); startEdit(p); }}
								class="h-full px-2.5 flex items-center text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors border-r border-gray-700"
								aria-label="Rename project"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="w-3.5 h-3.5">
									<path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke-linejoin="round"/>
									<path d="M10 4l2 2"/>
								</svg>
							</button>
							<button
								onclick={(e) => { e.stopPropagation(); deleteConfirmId = p.id; }}
								class="h-full px-2.5 flex items-center text-gray-600 hover:text-danger-400 hover:bg-gray-800 transition-colors"
								aria-label="Delete project"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="w-3.5 h-3.5">
									<path d="M3 4h10M6 4V2.5h4V4M5 4v8.5h6V4" stroke-linejoin="round"/>
									<path d="M7 7v4M9 7v4"/>
								</svg>
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- OPFS usage bar -->
	{#if storageQuota > 0}
		<div class="shrink-0 border-t border-gray-700 px-4 sm:px-6 py-2 flex items-center gap-3">
			<span class="text-xs text-gray-500 shrink-0">Storage</span>
			<div class="flex-1 h-2 bg-gray-800 border border-gray-700 min-w-0">
				<div class="h-full bg-secondary-400 transition-all" style="width: {usageFraction * 100}%"></div>
			</div>
			<span class="text-xs text-gray-500 shrink-0 tabular-nums">
				{formatBytes(storageUsage)} / {formatBytes(storageQuota)}
			</span>
		</div>
	{/if}
</div>

<!-- New project modal -->
{#if showNewModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onclick={(e) => { if (e.target === e.currentTarget) showNewModal = false; }}
	>
		<div class="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm shadow-2xl">
			<h2 class="text-xs uppercase tracking-widest text-gray-400 mb-4">New Project</h2>
			<input
				bind:this={newNameInput}
				bind:value={newName}
				onkeydown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') showNewModal = false; }}
				class="w-full bg-gray-800 border border-gray-700 focus:border-secondary-400 text-gray-100 text-sm px-3 py-2 focus:outline-none mb-4"
				placeholder="Project name"
			/>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => (showNewModal = false)}
					class="px-4 py-1.5 text-xs uppercase tracking-widest border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
				>Cancel</button>
				<button
					onclick={handleCreate}
					class="px-4 py-1.5 text-xs uppercase tracking-widest bg-secondary-400 text-gray-950 font-bold hover:bg-secondary-300 transition-colors"
				>Create</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirmation modal -->
{#if deleteConfirmId}
	{@const target = projects.list.find((p) => p.id === deleteConfirmId)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onclick={(e) => { if (e.target === e.currentTarget) deleteConfirmId = null; }}
	>
		<div class="bg-gray-900 border border-gray-700 p-6 w-full max-w-sm shadow-2xl">
			<h2 class="text-xs uppercase tracking-widest text-danger-400 mb-3">Delete Project</h2>
			<p class="text-sm text-gray-300 mb-4">
				Delete <strong class="text-gray-100">"{target?.name}"</strong>? All audio files and analysis results will be permanently removed.
			</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => deleteConfirmId = null}
					class="px-4 py-1.5 text-xs uppercase tracking-widest border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
				>Cancel</button>
				<button
					onclick={() => confirmDelete(deleteConfirmId!)}
					class="px-4 py-1.5 text-xs uppercase tracking-widest bg-danger-500 text-white font-bold hover:bg-danger-400 transition-colors"
				>Delete</button>
			</div>
		</div>
	</div>
{/if}
