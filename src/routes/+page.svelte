<script lang="ts">
	import Upload from '$lib/components/Upload.svelte';
	import Options from '$lib/components/Options.svelte';
	import Results from '$lib/components/Results.svelte';
</script>

<main>
	<div class="top">
		<Upload />
		<Options />
	</div>
	<Results />
</main>
