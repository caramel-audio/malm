<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import { files, setCurrentProjectId, extractMetadata } from '$lib/state/files.svelte';
	import {
		options,
		loadOptionsForProject,
		saveOptionsForProject,
		resetOptions
	} from '$lib/state/options.svelte';
	import { resetAnalysis } from '$lib/state/analysis.svelte';
	import { results, setResults, clearResults, markResultsStale } from '$lib/state/results.svelte';
	import { updateProjectMeta } from '$lib/state/project.svelte';
	import { loadAudioFiles, loadResults, saveResults } from '$lib/storage/opfs';
	import { toggle } from '$lib/audio/transport.svelte';
	import TransportBar from '$lib/components/TransportBar.svelte';
	import BusyOverlay from '$lib/components/BusyOverlay.svelte';

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
		void options.slope;
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
			await saveResults(id, snapshot);
			updateProjectMeta(id, { updatedAt: Date.now() });
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
		void options.slope;
		if (untrack(() => !isLoaded)) return;
		untrack(() => markResultsStale());
	});

	async function loadProject(id: string): Promise<void> {
		try {
			setCurrentProjectId(id);
			loadOptionsForProject(id);

			const audioFiles = await loadAudioFiles(id);
			if (audioFiles.length > 0) {
				// No decode on load: duration/sampleRate come from the manifest, and the
				// OPFS File is only read when metadata or analysis actually needs bytes.
				files.list = await Promise.all(
					audioFiles.map(async ({ meta, file: stored }) => {
						// Rewrap so the name/MIME match the original upload (cheap — the
						// File references the blob, it does not copy it).
						const file = new File([stored], meta.fileName, {
							type: meta.mimeType || 'audio/mpeg'
						});
						const tags = await extractMetadata(file);
						return {
							id: meta.id,
							file,
							name: tags.name,
							artist: tags.artist,
							album: tags.album,
							duration: meta.duration,
							codec: tags.codec,
							bitrate: tags.bitrate,
							sampleRate: meta.sampleRate ?? tags.sampleRate,
							coverUrl: tags.coverUrl
						};
					})
				);
			}

			const savedResults = await loadResults(id);
			if (savedResults) {
				setResults(savedResults);
				// Results saved before the streaming rewrite carry no waveform, so the
				// plot has nothing to draw. Mark them stale so Analyze is available
				// again instead of sitting disabled on "Already analyzed".
				if (savedResults.some((r) => !r.waveform?.length)) markResultsStale();
			}

			isLoaded = true;
		} catch (e) {
			console.error('Failed to load project:', e);
			loadError = 'Failed to load project data.';
			isLoaded = true;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
			return;
		if (event.key === ' ' || event.key === 'k') {
			event.preventDefault();
			toggle();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full min-h-0 flex-col">
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if !isLoaded}
			<BusyOverlay label="Loading project" />
		{:else if loadError}
			<div class="flex h-full items-center justify-center py-24 text-xs text-danger-400">
				{loadError}
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>

	<TransportBar />
</div>
