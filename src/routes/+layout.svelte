<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	let sliding = $state(false);
	let gone = $state(false);

	onMount(() => {
		setTimeout(() => {
			sliding = true;
			setTimeout(() => {
				gone = true;
			}, 500);
		}, 500);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if !gone}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950"
		style="transform: translateY({sliding ? '-100%' : '0'}); transition: transform 500ms ease-in-out;"
	>
		<span class="font-mono text-white text-8xl font-bold tracking-widest">MALM</span>
		<span class="font-mono text-gray-400 text-sm mt-4 tracking-wider">Multi audio loudness measurement</span>
		<svg class="h-24 w-auto mt-32" viewBox="0 0 1575 2848" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M1574.21 454.371L787.103 0L0 454.371V1363.11L54.083 1394.34C82.746 1435.29 102.679 1486.86 99.1021 1607.64C95.9603 1713.67 85.4044 1754.21 76.9461 1786.69L76.9449 1786.69C70.6166 1810.99 65.4634 1830.78 65.4634 1870.11C65.4634 1962.01 122.079 1981.8 169.131 1982.84C216.183 1983.87 271.821 1965.91 271.821 1870.11C271.821 1830.58 266.048 1810.68 259.43 1787.87L259.43 1787.87C250.008 1755.38 238.873 1716.99 240.254 1607.64C240.254 1565.69 257.045 1540.37 281.657 1525.71L628.129 1725.71C628.821 1727.46 629.645 1729.24 630.605 1731.04C686.928 1836.78 704.809 2038.65 707.49 2268.4C709.068 2403.57 690.363 2485.8 674.696 2554.68C663.734 2602.87 654.261 2644.52 654.261 2693.19C654.261 2811.43 734.718 2849.25 788.361 2847.97C842.004 2846.69 922.464 2806.62 922.464 2693.19C922.464 2644.35 913.602 2601.22 903.01 2549.67L903.008 2549.66C889.004 2481.51 871.977 2398.64 868.413 2268.4C862.152 2039.63 886.294 1845.44 937.252 1731.04L937.391 1730.73L1252.04 1549.09C1272.02 1566.55 1284.67 1578.78 1292.72 1593.52C1306.56 1618.85 1306.81 1651.6 1307.42 1731.04V1731.05L1307.42 1731.18C1307.54 1746.04 1307.66 1762.54 1307.9 1780.92C1309.27 1890.39 1291.71 1951.06 1276.99 2001.93L1276.98 2001.94C1266.64 2037.66 1257.7 2068.56 1257.7 2108.12C1257.7 2204.03 1328.04 2234.7 1374.94 2233.66C1421.84 2232.62 1492.18 2200.13 1492.18 2108.12C1492.18 2068.51 1485.12 2036.76 1476.63 1998.62L1476.63 1998.62C1465.41 1948.18 1451.7 1886.59 1448.58 1780.92C1443.11 1595.37 1491.76 1480.47 1536.32 1387.68C1536.91 1386.44 1537.43 1385.24 1537.86 1384.1L1574.21 1363.11V454.371Z" fill="#E6E6E6"/>
		</svg>
		<span class="font-mono text-gray-600 text-xs mt-6 tracking-wider">by Caramel</span>
	</div>
{/if}

<div class="min-h-screen bg-gray-950 text-gray-100 font-mono text-[13px]">
	{@render children()}
</div>
