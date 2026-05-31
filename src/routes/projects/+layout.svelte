<script lang="ts">
	import { onMount } from 'svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import { refreshProjectList } from '$lib/state/project.svelte';

	let { children } = $props();

	onMount(() => {
		refreshProjectList();
	});
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<NavBar />
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
