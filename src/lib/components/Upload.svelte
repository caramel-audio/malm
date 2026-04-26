<script lang="ts">
	// Top-left panel: drag-and-drop or file-picker upload
	import { files } from '$lib/state/files.svelte';
</script>

<section class="h-full flex flex-col">
	<div class="px-3 py-2 border-b border-[#3a3a3a] text-[#c8a84b] uppercase tracking-widest text-xs">
		FILES
	</div>

	<!-- Drop zone -->
	<div class="m-3 border border-dashed border-[#3a3a3a] flex flex-col items-center justify-center gap-2 py-6 text-[#6a6a6a] text-xs cursor-pointer hover:border-[#c8a84b] hover:text-[#c8a84b] transition-colors">
		<span>DROP AUDIO FILES HERE</span>
		<span>or <button class="underline">BROWSE</button></span>
		<input type="file" accept="audio/*" multiple hidden />
	</div>

	<!-- File list -->
	<ul class="flex-1 overflow-y-auto">
		{#each files.list as f (f.id)}
			<li class="flex items-center gap-3 px-3 py-1.5 border-b border-[#1f1f1f] hover:bg-[#1f1f1f]">
				<!-- TODO: drag handle -->
				<span class="flex-1 truncate">{f.name}</span>
				<span class="text-[#6a6a6a] shrink-0">{f.artist}</span>
				<span class="text-[#6a6a6a] shrink-0 tabular-nums">{f.duration}s</span>
				<button class="text-[#6a6a6a] hover:text-[#c8a84b]">✕</button>
			</li>
		{/each}
	</ul>
</section>
