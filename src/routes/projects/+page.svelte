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
		tick().then(() => {
			newNameInput?.focus();
			newNameInput?.select();
		});
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

<div class="flex h-full flex-col overflow-y-auto">
	<!-- Card grid -->
	<div class="flex-1 p-4 sm:p-6">
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<!-- New Project card -->
			<button
				onclick={openNewModal}
				class="flex min-h-[80px] items-center justify-center gap-2 border border-secondary-400 bg-secondary-400 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300"
			>
				<svg
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="square"
					class="h-4 w-4"
				>
					<path d="M8 2v12M2 8h12" />
				</svg>
				New Project
			</button>

			<!-- Existing project cards -->
			{#each projects.list as p (p.id)}
				<div
					class="relative border border-gray-700 bg-gray-900 transition-colors hover:border-gray-600"
				>
					{#if editingId === p.id}
						<!-- Rename mode -->
						<div class="p-4">
							<input
								bind:this={editingInput}
								bind:value={editingName}
								onblur={commitEdit}
								onkeydown={(e) => {
									e.stopPropagation();
									if (e.key === 'Enter') commitEdit();
									if (e.key === 'Escape') editingId = null;
								}}
								class="w-full border border-secondary-400 bg-gray-800 px-2 py-0.5 text-sm font-bold text-gray-100 focus:outline-none"
							/>
						</div>
					{:else}
						<!-- Normal mode: clickable card body -->
						<button
							class="flex w-full flex-col gap-2 p-4 pr-16 text-left"
							onclick={() => goto(`/projects/${p.id}`)}
						>
							<span class="truncate text-sm font-bold text-gray-100">{p.name}</span>
							<div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
						<div
							class="absolute top-0 right-0 bottom-0 flex items-center gap-0 border-l border-gray-700"
						>
							<button
								onclick={(e) => {
									e.stopPropagation();
									startEdit(p);
								}}
								class="flex h-full items-center border-r border-gray-700 px-2.5 text-gray-600 transition-colors hover:bg-gray-800 hover:text-gray-300"
								aria-label="Rename project"
							>
								<svg
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									class="h-3.5 w-3.5"
								>
									<path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke-linejoin="round" />
									<path d="M10 4l2 2" />
								</svg>
							</button>
							<button
								onclick={(e) => {
									e.stopPropagation();
									deleteConfirmId = p.id;
								}}
								class="flex h-full items-center px-2.5 text-gray-600 transition-colors hover:bg-gray-800 hover:text-danger-400"
								aria-label="Delete project"
							>
								<svg
									viewBox="0 0 16 16"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									class="h-3.5 w-3.5"
								>
									<path d="M3 4h10M6 4V2.5h4V4M5 4v8.5h6V4" stroke-linejoin="round" />
									<path d="M7 7v4M9 7v4" />
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
		<div class="flex shrink-0 items-center gap-3 border-t border-gray-700 px-4 py-2 sm:px-6">
			<span class="shrink-0 text-xs text-gray-500">Storage</span>
			<div class="h-2 min-w-0 flex-1 border border-gray-700 bg-gray-800">
				<div
					class="h-full bg-secondary-400 transition-all"
					style="width: {usageFraction * 100}%"
				></div>
			</div>
			<span class="shrink-0 text-xs text-gray-500 tabular-nums">
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
		onclick={(e) => {
			if (e.target === e.currentTarget) showNewModal = false;
		}}
	>
		<div class="w-full max-w-sm border border-gray-700 bg-gray-900 p-6 shadow-2xl">
			<h2 class="mb-4 text-xs tracking-widest text-gray-400 uppercase">New Project</h2>
			<input
				bind:this={newNameInput}
				bind:value={newName}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleCreate();
					if (e.key === 'Escape') showNewModal = false;
				}}
				class="mb-4 w-full border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-secondary-400 focus:outline-none"
				placeholder="Project name"
			/>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => (showNewModal = false)}
					class="border border-gray-700 px-4 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-gray-500 hover:text-gray-300"
					>Cancel</button
				>
				<button
					onclick={handleCreate}
					class="bg-secondary-400 px-4 py-1.5 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300"
					>Create</button
				>
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
		onclick={(e) => {
			if (e.target === e.currentTarget) deleteConfirmId = null;
		}}
	>
		<div class="w-full max-w-sm border border-gray-700 bg-gray-900 p-6 shadow-2xl">
			<h2 class="mb-3 text-xs tracking-widest text-danger-400 uppercase">Delete Project</h2>
			<p class="mb-4 text-sm text-gray-300">
				Delete <strong class="text-gray-100">"{target?.name}"</strong>? All audio files and analysis
				results will be permanently removed.
			</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => (deleteConfirmId = null)}
					class="border border-gray-700 px-4 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-gray-500 hover:text-gray-300"
					>Cancel</button
				>
				<button
					onclick={() => confirmDelete(deleteConfirmId!)}
					class="bg-danger-500 px-4 py-1.5 text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-danger-400"
					>Delete</button
				>
			</div>
		</div>
	</div>
{/if}
