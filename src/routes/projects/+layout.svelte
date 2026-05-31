<script lang="ts">
	import { onMount } from 'svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import { refreshProjectList } from '$lib/state/project.svelte';

	let { children } = $props();

	onMount(() => {
		refreshProjectList();
	});
</script>

<div class="flex flex-col h-screen overflow-hidden">
	<NavBar />
	<div class="flex-1 min-h-0 overflow-hidden">
		{@render children()}
	</div>
</div>
