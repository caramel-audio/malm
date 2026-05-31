<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { files, setCurrentProjectId, makeCoverUrl, sampleRateFromBuffer } from '$lib/state/files.svelte';
	import { options, loadOptionsForProject, saveOptionsForProject, resetOptions } from '$lib/state/options.svelte';
	import { results, setResults, clearResults, markResultsStale } from '$lib/state/results.svelte';
	import { updateProjectMeta } from '$lib/state/project.svelte';
	import { loadAudioFiles, loadResults, saveResults } from '$lib/storage/opfs';
	import { togglePlayPause } from '$lib/audio/playback.svelte';

	let { children } = $props();

	let isLoaded = $state(false);
	let loadError = $state<string | null>(null);

	// $page.params.id is always defined for this route, but TypeScript types it as string | undefined.
	const projectId = $derived($page.params.id as string);

	let optionsSaveTimer: ReturnType<typeof setTimeout>;
	let resultsSaveTimer: ReturnType<typeof setTimeout>;

	// Reload project whenever projectId changes (handles switching via nav dropdown too).
	$effect(() => {
		const id = projectId; // reactive dependency
		isLoaded = false;
		loadError = null;
		setCurrentProjectId(null);
		files.list = [];
		clearResults();
		resetOptions();
		clearTimeout(optionsSaveTimer);
		clearTimeout(resultsSaveTimer);

		loadProject(id);

		return () => {
			setCurrentProjectId(null);
			for (const f of files.list) {
				if (f.coverUrl) URL.revokeObjectURL(f.coverUrl);
			}
			files.list = [];
			clearResults();
			resetOptions();
			clearTimeout(optionsSaveTimer);
			clearTimeout(resultsSaveTimer);
		};
	});

	// Auto-save options (debounced, only once project is loaded).
	$effect(() => {
		const freqs = [...options.frequencies]; // reactive dependency
		const id = projectId;
		if (!isLoaded) return;
		clearTimeout(optionsSaveTimer);
		optionsSaveTimer = setTimeout(() => saveOptionsForProject(id), 300);
	});

	// Auto-save results (debounced, only once project is loaded).
	$effect(() => {
		const snapshot = results.data; // reactive dependency
		const id = projectId;
		if (!isLoaded || snapshot.length === 0) return;
		clearTimeout(resultsSaveTimer);
		resultsSaveTimer = setTimeout(async () => {
			await saveResults(id, snapshot);
			updateProjectMeta(id, { updatedAt: Date.now() });
		}, 500);
	});

	// Mark results stale when files or options change after initial load.
	// Uses untrack() so isLoaded is not a reactive dep — avoids firing on load completion.
	$effect(() => {
		files.list.map(f => f.id).join(','); // reactive dep: file set
		if (untrack(() => !isLoaded)) return;
		untrack(() => markResultsStale());
	});

	$effect(() => {
		options.frequencies.join(','); // reactive dep: crossover frequencies
		if (untrack(() => !isLoaded)) return;
		untrack(() => markResultsStale());
	});

	async function loadProject(id: string): Promise<void> {
		try {
			setCurrentProjectId(id);
			loadOptionsForProject(id);

			const audioFiles = await loadAudioFiles(id);
			if (audioFiles.length > 0) {
				const ctx = new AudioContext();
				const loaded = await Promise.all(
					audioFiles.map(async ({ meta, arrayBuffer }) => {
						const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
						const coverUrl = await makeCoverUrl(arrayBuffer, meta.mimeType || 'audio/mpeg');
						return {
							id: meta.id,
							file: new File([arrayBuffer], meta.fileName, {
								type: meta.mimeType || 'audio/mpeg'
							}),
							name: meta.name,
							artist: meta.artist,
							album: meta.album ?? '',
							duration: meta.duration,
							codec: meta.codec ?? '',
							bitrate: meta.bitrate ?? null,
							sampleRate: meta.sampleRate ?? sampleRateFromBuffer(arrayBuffer, meta.mimeType, meta.fileName),
							coverUrl,
							buffer
						};
					})
				);
				ctx.close();
				files.list = loaded;
			}

			const savedResults = await loadResults(id);
			if (savedResults) {
				setResults(savedResults);
				goto(`/projects/${id}/analysis`, { replaceState: true });
			}

			isLoaded = true;
		} catch (e) {
			console.error('Failed to load project:', e);
			loadError = 'Failed to load project data.';
			isLoaded = true;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
		if (event.key === ' ' || event.key === 'k') {
			event.preventDefault();
			togglePlayPause();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !isLoaded}
	<div class="flex items-center justify-center h-full py-24 text-gray-600 text-xs uppercase tracking-widest">
		Loading…
	</div>
{:else if loadError}
	<div class="flex items-center justify-center h-full py-24 text-danger-400 text-xs">
		{loadError}
	</div>
{:else}
	<div class="flex-1 flex flex-col min-h-0 h-full">
		{@render children()}
	</div>
{/if}
