<script lang="ts">
	import { options, addFrequency, removeFrequency, resetOptions } from '$lib/state/options.svelte';

	let newFreq = $state('');
	let inputError = $state('');

	function fmtHz(hz: number): string {
		return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
	}

	function bandLabels(freqs: number[]): string[] {
		if (freqs.length === 0) return ['Full'];
		const s = [...freqs].sort((a, b) => a - b);
		const out: string[] = [`0–${fmtHz(s[0])} Hz`];
		for (let i = 0; i < s.length - 1; i++) {
			out.push(`${fmtHz(s[i])}–${fmtHz(s[i + 1])} Hz`);
		}
		out.push(`${fmtHz(s[s.length - 1])}+ Hz`);
		return out;
	}

	function handleAdd() {
		const hz = Number(newFreq);
		if (!Number.isFinite(hz) || hz <= 0 || !Number.isInteger(hz)) {
			inputError = 'Enter a positive integer';
			return;
		}
		if (options.frequencies.includes(hz)) {
			inputError = 'Already exists';
			return;
		}
		addFrequency(hz);
		newFreq = '';
		inputError = '';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAdd();
		else inputError = '';
	}
</script>

<section class="h-full flex flex-col">
	<div class="px-3 py-2 border-b border-gray-700 text-secondary-400 uppercase tracking-widest text-xs flex items-center justify-between">
		<span>OPTIONS</span>
		<button
			onclick={resetOptions}
			class="text-gray-600 hover:text-gray-300 text-xs uppercase tracking-widest transition-colors"
		>Reset</button>
	</div>

	<div class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
		<!-- Crossovers + Add -->
		<div class="flex gap-8">
			<div class="w-1/2 min-w-0">
				<div class="text-gray-400 text-xs uppercase tracking-widest mb-2">Crossovers</div>
				{#if options.frequencies.length === 0}
					<div class="text-gray-500 text-xs italic">None</div>
				{:else}
					<ul class="flex flex-col gap-0.5">
						{#each options.frequencies as hz (hz)}
							<li class="flex items-center gap-2 group">
								<span class="tabular-nums text-xs text-gray-100 w-14 text-right">{hz}</span>
								<span class="text-gray-400 text-xs">Hz</span>
								<button
									class="ml-auto text-gray-600 group-hover:text-gray-400 hover:!text-secondary-400 text-xs"
									onclick={() => removeFrequency(hz)}
									aria-label="Remove {hz} Hz"
								>✕</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="w-1/2">
				<div class="text-gray-400 text-xs uppercase tracking-widest mb-2">Add</div>
				<div class="flex gap-2 items-center">
					<input
						type="number"
						min="1"
						step="1"
						bind:value={newFreq}
						onkeydown={onKeydown}
						placeholder="Hz"
						class="w-20 bg-gray-900 border border-gray-700 text-gray-100 text-xs px-2 py-1 focus:outline-none focus:border-secondary-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					/>
					<button
						onclick={handleAdd}
						class="px-3 py-1 text-xs uppercase tracking-widest border border-gray-700 text-gray-400 hover:border-secondary-400 hover:text-secondary-400"
					>+</button>
				</div>
				{#if inputError}
					<div class="text-danger-400 text-xs mt-1">{inputError}</div>
				{/if}
			</div>
		</div>

		<!-- Resulting bands -->
		<div>
			<div class="text-gray-400 text-xs uppercase tracking-widest mb-2">Resulting Bands</div>
			<div class="flex flex-wrap gap-1">
				{#each bandLabels(options.frequencies) as label (label)}
					<span class="text-xs border border-gray-700 text-gray-400 px-1.5 py-0.5">{label}</span>
				{/each}
			</div>
		</div>
	</div>
</section>
