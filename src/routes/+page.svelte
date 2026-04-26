<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import Results from '$lib/components/Results.svelte';
</script>

<main class="flex flex-col h-screen">
	<!-- Top row: Upload (left) + Options (right) -->
	<div class="flex border-b border-[#3a3a3a]" style="height: 280px;">
		<div class="w-2/3 border-r border-[#3a3a3a]">
			<Upload />
		</div>
		<div class="w-1/3">
			<Options />
		</div>
	</div>

	<!-- Bottom: Results -->
	<div class="flex-1 overflow-y-auto">
		<Results />
	</div>
</main>
