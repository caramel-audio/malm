<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { projects } from '$lib/state/project.svelte';
	import InfoModal from './InfoModal.svelte';

	let showInfo = $state(false);
	let showProjectDropdown = $state(false);

	const projectId = $derived($page.params.id as string | undefined);
	const currentProject = $derived(
		projectId ? (projects.list.find((p) => p.id === projectId) ?? null) : null
	);
	const otherProjects = $derived(projectId ? projects.list.filter((p) => p.id !== projectId) : []);

	const isSetup = $derived($page.url.pathname.endsWith('/setup'));
	const isAnalysis = $derived($page.url.pathname.endsWith('/analysis'));

	function closeDropdown() {
		showProjectDropdown = false;
	}

	function switchProject(id: string) {
		showProjectDropdown = false;
		goto(`/projects/${id}/setup`);
	}
</script>

<!-- Click-outside to close dropdown -->
{#if showProjectDropdown}
	<div class="fixed inset-0 z-20" role="presentation" onclick={closeDropdown}></div>
{/if}

<nav
	class="relative z-30 flex shrink-0 flex-col items-stretch border-b border-gray-700 bg-gray-950 sm:flex-row"
>
	<!-- Primary row: logo + breadcrumb + info -->
	<div class="flex h-10 items-stretch {currentProject ? 'sm:flex-1' : 'w-full'}">
		<!-- Logo section -->
		<a
			href="/projects"
			class="group flex shrink-0 items-center gap-2 border-r border-gray-700 px-3 sm:px-4"
		>
			<svg
				class="h-4 w-auto text-gray-300 transition-colors group-hover:text-white"
				viewBox="0 0 1575 2848"
				fill="currentColor"
				xmlns="http://www.w3.org/2000/svg"
				aria-label="Caramel"
			>
				<path
					d="M1574.21 454.371L787.103 0L0 454.371V1363.11L54.083 1394.34C82.746 1435.29 102.679 1486.86 99.1021 1607.64C95.9603 1713.67 85.4044 1754.21 76.9461 1786.69L76.9449 1786.69C70.6166 1810.99 65.4634 1830.78 65.4634 1870.11C65.4634 1962.01 122.079 1981.8 169.131 1982.84C216.183 1983.87 271.821 1965.91 271.821 1870.11C271.821 1830.58 266.048 1810.68 259.43 1787.87L259.43 1787.87C250.008 1755.38 238.873 1716.99 240.254 1607.64C240.254 1565.69 257.045 1540.37 281.657 1525.71L628.129 1725.71C628.821 1727.46 629.645 1729.24 630.605 1731.04C686.928 1836.78 704.809 2038.65 707.49 2268.4C709.068 2403.57 690.363 2485.8 674.696 2554.68C663.734 2602.87 654.261 2644.52 654.261 2693.19C654.261 2811.43 734.718 2849.25 788.361 2847.97C842.004 2846.69 922.464 2806.62 922.464 2693.19C922.464 2644.35 913.602 2601.22 903.01 2549.67L903.008 2549.66C889.004 2481.51 871.977 2398.64 868.413 2268.4C862.152 2039.63 886.294 1845.44 937.252 1731.04L937.391 1730.73L1252.04 1549.09C1272.02 1566.55 1284.67 1578.78 1292.72 1593.52C1306.56 1618.85 1306.81 1651.6 1307.42 1731.04V1731.05L1307.42 1731.18C1307.54 1746.04 1307.66 1762.54 1307.9 1780.92C1309.27 1890.39 1291.71 1951.06 1276.99 2001.93L1276.98 2001.94C1266.64 2037.66 1257.7 2068.56 1257.7 2108.12C1257.7 2204.03 1328.04 2234.7 1374.94 2233.66C1421.84 2232.62 1492.18 2200.13 1492.18 2108.12C1492.18 2068.51 1485.12 2036.76 1476.63 1998.62L1476.63 1998.62C1465.41 1948.18 1451.7 1886.59 1448.58 1780.92C1443.11 1595.37 1491.76 1480.47 1536.32 1387.68C1536.91 1386.44 1537.43 1385.24 1537.86 1384.1L1574.21 1363.11V454.371Z"
				/>
			</svg>
			<span
				class="hidden font-mono text-sm font-bold tracking-widest text-gray-100 transition-colors group-hover:text-white sm:inline"
				>MALM</span
			>
		</a>

		{#if currentProject}
			<!-- Breadcrumb section -->
			<div
				class="flex min-w-0 flex-1 items-center gap-1 border-r border-gray-700 px-3 font-mono text-xs"
			>
				<a
					href="/projects"
					class="flex shrink-0 items-center gap-1 text-gray-500 transition-colors hover:text-gray-300"
				>
					<svg
						class="h-3 w-3"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M7.5 2L3.5 6L7.5 10" />
					</svg>
					<span class="hidden sm:inline">Projects</span>
				</a>

				<span class="shrink-0 text-gray-700">/</span>

				<div class="relative min-w-0">
					<button
						class="flex min-w-0 items-center gap-1 text-gray-300 transition-colors hover:text-white"
						onclick={() => (showProjectDropdown = !showProjectDropdown)}
						aria-haspopup="listbox"
						aria-expanded={showProjectDropdown}
					>
						<span class="truncate">{currentProject.name}</span>
						<svg
							class="h-3 w-3 shrink-0 transition-transform {showProjectDropdown
								? 'rotate-180'
								: ''}"
							viewBox="0 0 12 12"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M2 4.5L6 8.5L10 4.5" />
						</svg>
					</button>

					{#if showProjectDropdown}
						<div
							class="absolute top-full left-0 z-40 mt-1 min-w-[180px] border border-gray-700 bg-gray-900 shadow-xl"
							role="listbox"
							aria-label="Switch project"
						>
							{#if otherProjects.length === 0}
								<div class="px-3 py-2 text-xs text-gray-500 italic">No other projects</div>
							{:else}
								{#each otherProjects as p (p.id)}
									<button
										class="w-full truncate px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
										onclick={() => switchProject(p.id)}
										role="option"
										aria-selected={false}>{p.name}</button
									>
								{/each}
							{/if}
							<div class="border-t border-gray-700">
								<a
									href="/projects"
									class="block px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-300"
									onclick={closeDropdown}>All projects…</a
								>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Tabs: desktop only (mobile tabs are in the second row below) -->
			<div class="hidden shrink-0 items-stretch border-r border-gray-700 sm:flex">
				<a
					href="/projects/{projectId}/setup"
					class="flex items-center px-6 text-xs tracking-widest uppercase transition-colors
						{isSetup ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
					>Setup</a
				>
				<a
					href="/projects/{projectId}/analysis"
					class="flex items-center border-l border-gray-700 px-6 text-xs tracking-widest uppercase transition-colors
						{isAnalysis ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
					>Analysis</a
				>
			</div>
		{:else}
			<div class="flex-1"></div>
		{/if}

		<!-- Info button -->
		<div class="flex shrink-0 items-center px-3">
			<button
				class="flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 font-mono text-xs leading-none text-gray-500 hover:border-gray-400 hover:text-gray-300"
				onclick={() => (showInfo = true)}
				aria-label="About">i</button
			>
		</div>
	</div>

	<!-- Mobile tab row: only shown inside a project on narrow screens -->
	{#if currentProject}
		<div class="flex h-10 items-stretch border-t border-gray-700 sm:hidden">
			<a
				href="/projects/{projectId}/setup"
				class="flex flex-1 items-center justify-center text-xs tracking-widest uppercase transition-colors
					{isSetup ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
				>Setup</a
			>
			<a
				href="/projects/{projectId}/analysis"
				class="flex flex-1 items-center justify-center border-l border-gray-700 text-xs tracking-widest uppercase transition-colors
					{isAnalysis ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'}"
				>Analysis</a
			>
		</div>
	{/if}
</nav>

{#if showInfo}
	<InfoModal onclose={() => (showInfo = false)} />
{/if}
