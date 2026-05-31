<script module lang="ts">
	declare const __APP_VERSION__: string;
</script>

<script lang="ts">
	let { onclose }: { onclose: () => void } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-8"
	role="presentation"
	onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
>
	<div class="bg-gray-900 border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
		<button
			class="absolute top-4 right-4 text-gray-500 hover:text-white text-base font-mono w-6 h-6 flex items-center justify-center"
			onclick={onclose}
			aria-label="Close"
		>✕</button>

		<div class="p-8 sm:p-10">
			<!-- Title -->
			<div class="mb-8">
				<span class="font-mono text-white text-5xl sm:text-6xl font-bold tracking-widest">MALM</span>
				<p class="font-mono text-gray-400 text-sm mt-3 tracking-wider">Multi audio loudness measurement</p>
				<p class="font-mono text-gray-600 text-xs mt-1 tracking-wider">v{__APP_VERSION__}</p>
			</div>

			<!-- Info sections -->
			<div class="space-y-6 mb-10">
				<section>
					<h2 class="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">What is MALM?</h2>
					<p class="text-sm text-gray-500 leading-relaxed">Multi Audio Loudness Measurement (MALM) is a browser tool for analyzing audio file loudness. It is intended for audio professionals and musicians to assist in the mastering workflow by comparing your work to other works. You can measure the LUFS of a file, but also split the file into frequency bands, and measure as well as listen to the bands.<br>More features might be added later.</p>
				</section>
				<section>
					<h2 class="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">How does it work?</h2>
					<p class="text-sm text-gray-500 leading-relaxed">All processing happens right in your browser: Metadata extraction, loudness measurement, band filtering is all done in Javascript.</p>
				</section>
				<section>
					<h2 class="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">What happens to my data?</h2>
					<p class="text-sm text-gray-500 leading-relaxed">Nothing. Everything is processed and stored locally on your machine. MALM uses the OPFS system to store your projects in your computer's file system.</p>
				</section>
				<section>
					<h2 class="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">Who created this?</h2>
					<p class="text-sm text-gray-500 leading-relaxed">MALM is a side project of the <a href="https://caramel.audio" target="_blank" rel="noopener noreferrer" class="hover:text-white underline underline-offset-2">Caramel Audio</a> team. Our main project is to build a live audio processing machine that gives endless possibilites to audio professionals, musicians, and the like.</p>
				</section>
				<section>
					<h2 class="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2">Open Source</h2>
					<p class="text-sm text-gray-500 leading-relaxed">MALM is completely free and open source under the MIT license. You can look at the source code and contribute on the <a href="https://github.com/caramel-audio/malm" target="_blank" rel="noopener noreferrer" class="hover:text-white underline underline-offset-2">GitHub repository</a>.<br> Found a bug or want a feature? <a href="https://github.com/caramel-audio/malm/issues" target="_blank" rel="noopener noreferrer" class="hover:text-white underline underline-offset-2">Create an issue</a>.</p>
				</section>
			</div>

			<!-- Logo + Caramel -->
			<div class="flex flex-col items-center border-t border-gray-800 pt-8">
				<svg class="h-16 w-auto" viewBox="0 0 1575 2848" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1574.21 454.371L787.103 0L0 454.371V1363.11L54.083 1394.34C82.746 1435.29 102.679 1486.86 99.1021 1607.64C95.9603 1713.67 85.4044 1754.21 76.9461 1786.69L76.9449 1786.69C70.6166 1810.99 65.4634 1830.78 65.4634 1870.11C65.4634 1962.01 122.079 1981.8 169.131 1982.84C216.183 1983.87 271.821 1965.91 271.821 1870.11C271.821 1830.58 266.048 1810.68 259.43 1787.87L259.43 1787.87C250.008 1755.38 238.873 1716.99 240.254 1607.64C240.254 1565.69 257.045 1540.37 281.657 1525.71L628.129 1725.71C628.821 1727.46 629.645 1729.24 630.605 1731.04C686.928 1836.78 704.809 2038.65 707.49 2268.4C709.068 2403.57 690.363 2485.8 674.696 2554.68C663.734 2602.87 654.261 2644.52 654.261 2693.19C654.261 2811.43 734.718 2849.25 788.361 2847.97C842.004 2846.69 922.464 2806.62 922.464 2693.19C922.464 2644.35 913.602 2601.22 903.01 2549.67L903.008 2549.66C889.004 2481.51 871.977 2398.64 868.413 2268.4C862.152 2039.63 886.294 1845.44 937.252 1731.04L937.391 1730.73L1252.04 1549.09C1272.02 1566.55 1284.67 1578.78 1292.72 1593.52C1306.56 1618.85 1306.81 1651.6 1307.42 1731.04V1731.05L1307.42 1731.18C1307.54 1746.04 1307.66 1762.54 1307.9 1780.92C1309.27 1890.39 1291.71 1951.06 1276.99 2001.93L1276.98 2001.94C1266.64 2037.66 1257.7 2068.56 1257.7 2108.12C1257.7 2204.03 1328.04 2234.7 1374.94 2233.66C1421.84 2232.62 1492.18 2200.13 1492.18 2108.12C1492.18 2068.51 1485.12 2036.76 1476.63 1998.62L1476.63 1998.62C1465.41 1948.18 1451.7 1886.59 1448.58 1780.92C1443.11 1595.37 1491.76 1480.47 1536.32 1387.68C1536.91 1386.44 1537.43 1385.24 1537.86 1384.1L1574.21 1363.11V454.371Z" fill="#E6E6E6"/>
				</svg>
				<span class="font-mono text-gray-600 text-xs mt-4 tracking-wider">
					by <a href="https://caramel.audio" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-white underline underline-offset-2">Caramel</a>
				</span>
				<div class="flex gap-5 mt-3">
					<a href="https://github.com/caramel-audio" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-300" aria-label="GitHub">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
					</a>
					<a href="https://linkedin.com/company/caramel-audio" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-300" aria-label="LinkedIn">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
					</a>
					<a href="https://instagram.com/caramel.audio" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-300" aria-label="Instagram">
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
