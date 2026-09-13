<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { options, resetOptions } from '$lib/state/options.svelte';
	import { SLOPES, SLOPE_LABELS } from '$lib/audio/filters';
	import { page } from '$app/stores';
	import { projects } from '$lib/state/project.svelte';
	import {
		presets,
		loadPresets,
		savePreset,
		deletePreset,
		applyPreset,
		projectCrossovers
	} from '$lib/state/presets.svelte';
	import CrossoverBar from './CrossoverBar.svelte';

	let showSave = $state(false);
	let showLoad = $state(false);
	let presetName = $state('');
	let nameInput: HTMLInputElement | undefined = $state();

	const fromProjects = $derived(
		showLoad ? projectCrossovers(projects.list).filter((p) => p.id !== $page.params.id) : []
	);

	onMount(loadPresets);

	function openSave() {
		presetName = '';
		showSave = true;
		tick().then(() => nameInput?.focus());
	}

	function confirmSave() {
		savePreset(presetName, options.frequencies, options.slope);
		showSave = false;
	}
</script>

<section class="flex h-full flex-col">
	<div
		class="flex items-center justify-between border-b border-gray-700 px-3 py-2 text-xs tracking-widest text-secondary-400 uppercase"
	>
		<span>OPTIONS</span>
		<button
			onclick={resetOptions}
			class="text-xs tracking-widest text-gray-600 uppercase transition-colors hover:text-gray-300"
			>Reset</button
		>
	</div>

	<div class="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
		<div class="flex items-center justify-between">
			<div class="text-xs tracking-widest text-gray-400 uppercase">Crossovers</div>
			<div class="text-xs text-gray-600">Click bar to add · drag to move</div>
		</div>

		<CrossoverBar bind:frequencies={options.frequencies} />

		<div class="flex gap-2">
			<button
				onclick={openSave}
				class="flex-1 cursor-pointer border border-gray-700 px-3 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-secondary-400 hover:text-secondary-400"
				>Save</button
			>
			<button
				onclick={() => {
					loadPresets();
					showLoad = true;
				}}
				class="flex-1 cursor-pointer border border-gray-700 px-3 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-secondary-400 hover:text-secondary-400"
				>Load</button
			>
		</div>

		<div class="mt-2 flex items-center justify-between">
			<div class="text-xs tracking-widest text-gray-400 uppercase">Filter</div>
			<div class="text-xs text-gray-600">Slope per crossover</div>
		</div>
		<div class="grid grid-cols-3 border border-gray-700">
			{#each SLOPES as slope, i (slope)}
				<button
					onclick={() => (options.slope = slope)}
					class="px-2 py-1.5 text-center text-[11px] tracking-wider whitespace-nowrap uppercase transition-colors
						{i % 3 > 0 ? 'border-l border-gray-700' : ''}
						{i > 2 ? 'border-t border-gray-700' : ''}
						{options.slope === slope
						? 'bg-gray-800 text-gray-100'
						: 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
					aria-pressed={options.slope === slope}>{SLOPE_LABELS[slope]}</button
				>
			{/each}
		</div>
	</div>
</section>

{#if showSave}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) showSave = false;
		}}
	>
		<div class="w-full max-w-sm border border-gray-700 bg-gray-900 p-6 shadow-2xl">
			<h2 class="mb-3 text-xs tracking-widest text-secondary-400 uppercase">Save crossover</h2>
			<input
				bind:this={nameInput}
				bind:value={presetName}
				placeholder="Crossover name"
				onkeydown={(e) => e.key === 'Enter' && confirmSave()}
				class="mb-4 w-full border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-secondary-400 focus:outline-none"
			/>
			<div class="flex justify-end gap-2">
				<button
					onclick={() => (showSave = false)}
					class="border border-gray-700 px-4 py-1.5 text-xs tracking-widest text-gray-400 uppercase transition-colors hover:border-gray-500 hover:text-gray-300"
					>Cancel</button
				>
				<button
					onclick={confirmSave}
					class="bg-secondary-400 px-4 py-1.5 text-xs font-bold tracking-widest text-gray-950 uppercase transition-colors hover:bg-secondary-300"
					>Save</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showLoad}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) showLoad = false;
		}}
	>
		<div
			class="flex max-h-[80vh] w-full max-w-2xl flex-col border border-gray-700 bg-gray-900 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-gray-700 px-4 py-3">
				<h2 class="text-xs tracking-widest text-secondary-400 uppercase">Load crossover</h2>
				<button
					onclick={() => (showLoad = false)}
					class="text-xs text-gray-500 hover:text-gray-300"
					aria-label="Close">✕</button
				>
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto">
				<div class="px-4 py-2 text-[10px] tracking-widest text-gray-500 uppercase">Saved</div>
				{#if presets.list.length === 0}
					<p class="px-4 pb-3 text-xs text-gray-600 italic">No saved crossovers yet.</p>
				{:else}
					{#each presets.list as preset (preset.name)}
						<div class="flex items-center gap-3 border-t border-gray-800 px-4 py-2">
							<button
								class="min-w-0 flex-1 cursor-pointer truncate text-left text-xs text-gray-100 hover:text-secondary-400"
								onclick={() => {
									applyPreset(preset);
									showLoad = false;
								}}
							>
								{preset.name}
								<span class="ml-2 text-[10px] text-gray-500"
									>{preset.frequencies.join(' · ')} Hz · {SLOPE_LABELS[preset.slope]}</span
								>
							</button>
							<button
								class="shrink-0 text-xs text-gray-600 hover:text-danger-400"
								onclick={() => deletePreset(preset.name)}
								aria-label="Delete {preset.name}">✕</button
							>
						</div>
					{/each}
				{/if}

				<div
					class="mt-2 border-t border-gray-700 px-4 py-2 text-[10px] tracking-widest text-gray-500 uppercase"
				>
					From project
				</div>
				{#if fromProjects.length === 0}
					<p class="px-4 pb-3 text-xs text-gray-600 italic">No other project has crossovers.</p>
				{:else}
					{#each fromProjects as p (p.id)}
						<button
							class="flex w-full cursor-pointer items-center gap-4 border-t border-gray-800 px-4 py-2 text-left hover:bg-gray-800/50"
							onclick={() => {
								applyPreset(p);
								showLoad = false;
							}}
						>
							<span class="w-32 shrink-0 truncate text-xs text-gray-100">{p.name}</span>
							<div class="min-w-0 flex-1">
								<CrossoverBar frequencies={p.frequencies} readonly />
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
