<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import {
		files,
		setCurrentProjectId,
		extractMetadata,
		sampleRateFromBuffer
	} from '$lib/state/files.svelte';
	import {
		options,
		loadOptionsForProject,
		saveOptionsForProject,
		resetOptions
	} from '$lib/state/options.svelte';
	import { resetAnalysis } from '$lib/state/analysis.svelte';
	import { results, setResults, clearResults, markResultsStale } from '$lib/state/results.svelte';
	import { updateProjectMeta } from '$lib/state/project.svelte';
	import { isStorageAvailable, loadAudioFiles, loadResults, saveResults } from '$lib/storage/opfs';
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
		resetAnalysis();
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
			resetAnalysis();
			clearTimeout(optionsSaveTimer);
			clearTimeout(resultsSaveTimer);
		};
	});

	// Auto-save options (debounced, only once project is loaded).
	$effect(() => {
		// Access each field to register as a reactive dependency.
		void options.frequencies.join(',');
		void options.selectedBand;
		void options.loudnessType;
		void options.normalizeToQuietest;
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
			try {
				await saveResults(id, snapshot);
				updateProjectMeta(id, { updatedAt: Date.now() });
			} catch (e) {
				console.warn('Could not persist results:', e);
			}
		}, 500);
	});

	// Mark results stale when files or options change after initial load.
	// Uses untrack() so isLoaded is not a reactive dep — avoids firing on load completion.
	$effect(() => {
		files.list.map((f) => f.id).join(','); // reactive dep: file set
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

			if (!isStorageAvailable()) {
				loadError = 'This browser cannot store audio — files stay in memory for this session.';
				isLoaded = true;
				return;
			}

			const audioFiles = await loadAudioFiles(id);
			if (audioFiles.length > 0) {
				const ctx = new AudioContext();
				const loaded = await Promise.all(
					audioFiles.map(async ({ meta, arrayBuffer }) => {
						const file = new File([arrayBuffer], meta.fileName, {
							type: meta.mimeType || 'audio/mpeg'
						});
						const [buffer, tags] = await Promise.all([
							ctx.decodeAudioData(arrayBuffer.slice(0)),
							extractMetadata(file)
						]);
						return {
							id: meta.id,
							file,
							name: tags.name,
							artist: tags.artist,
							album: tags.album,
							duration: buffer.duration,
							codec: tags.codec,
							bitrate: tags.bitrate,
							sampleRate:
								tags.sampleRate ?? sampleRateFromBuffer(arrayBuffer, meta.mimeType, meta.fileName),
							coverUrl: tags.coverUrl,
							buffer
						};
					})
				);
				ctx.close();
				files.list = loaded;
			}

			const savedResults = await loadResults(id);
			if (savedResults) setResults(savedResults);

			isLoaded = true;
		} catch (e) {
			// Storage can be unavailable (iOS private browsing) or a read can fail.
			// Keep the project usable in memory instead of blocking the whole page.
			console.error('Failed to load project:', e);
			loadError = 'Saved data could not be loaded — this session will not be stored.';
			isLoaded = true;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
			return;
		if (event.key === ' ' || event.key === 'k') {
			event.preventDefault();
			togglePlayPause();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if !isLoaded}
	<div
		class="flex h-full items-center justify-center py-24 text-xs tracking-widest text-gray-600 uppercase"
	>
		Loading…
	</div>
{:else}
	<div class="flex h-full min-h-0 flex-1 flex-col">
		{#if loadError}
			<div
				class="shrink-0 border-b border-gray-700 px-3 py-2 text-center text-xs text-danger-400"
				role="alert"
			>
				{loadError}
			</div>
		{/if}
		{@render children()}
	</div>
{/if}
