<script lang="ts">
	// Top-right panel: frequency band config + process / reset buttons
	import { options } from '$lib/state/options.svelte';
</script>

<section class="h-full flex flex-col">
	<div class="px-3 py-2 border-b border-[#3a3a3a] text-[#c8a84b] uppercase tracking-widest text-xs">
		OPTIONS
	</div>

	<div class="flex-1 px-3 py-3 flex flex-col gap-3">
		<!-- Frequency list -->
		<div class="text-[#6a6a6a] text-xs uppercase tracking-widest mb-1">Crossover Frequencies</div>
		<ul class="flex flex-col gap-1">
			{#each options.frequencies as freq}
				<li class="flex items-center gap-2">
					<span class="tabular-nums w-16 text-right">{freq}</span>
					<span class="text-[#6a6a6a]">Hz</span>
					<!-- TODO: remove button -->
				</li>
			{/each}
		</ul>
		<!-- TODO: add-frequency input -->
	</div>

	<!-- Progress bar -->
	{#if options.isAnalyzing}
		<div class="mx-3 mb-2 h-1 bg-[#1a1a1a] border border-[#3a3a3a]">
			<div class="h-full bg-[#c8a84b] w-1/2 transition-all"></div>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="flex border-t border-[#3a3a3a]">
		<button
			disabled={options.isAnalyzing}
			class="flex-1 py-2 text-xs uppercase tracking-widest bg-[#c8a84b] text-[#0e0e0e] font-bold hover:bg-[#d4b85a] disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{options.isAnalyzing ? 'ANALYZING…' : 'ANALYZE'}
		</button>
		<button class="px-4 py-2 text-xs uppercase tracking-widest border-l border-[#3a3a3a] text-[#6a6a6a] hover:text-[#d4d0c8]">
			RESET
		</button>
	</div>
</section>
