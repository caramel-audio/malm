<script lang="ts">
	import { options, addFrequency, removeFrequency, resetOptions } from '$lib/state/options.svelte';

	const MIN_HZ = 20;
	const MAX_HZ = 20000;
	const LOG_MIN = Math.log10(MIN_HZ);
	const LOG_MAX = Math.log10(MAX_HZ);
	const LOG_SPAN = LOG_MAX - LOG_MIN;

	function hzToPct(hz: number): number {
		const clamped = Math.max(MIN_HZ, Math.min(MAX_HZ, hz));
		return ((Math.log10(clamped) - LOG_MIN) / LOG_SPAN) * 100;
	}

	function pctToHz(pct: number): number {
		const p = Math.max(0, Math.min(100, pct));
		return Math.round(Math.pow(10, LOG_MIN + (p / 100) * LOG_SPAN));
	}

	let barEl = $state<HTMLDivElement | null>(null);
	let dragIndex = $state<number | null>(null);
	let hoverIndex = $state<number | null>(null);
	let editError = $state<{ index: number; msg: string } | null>(null);
	let dragPointerId: number | null = null;

	const bandRanges = $derived.by(() => {
		const sorted = [...options.frequencies].sort((a, b) => a - b);
		const stops = [MIN_HZ, ...sorted, MAX_HZ];
		const ranges: { start: number; end: number }[] = [];
		for (let i = 0; i < stops.length - 1; i++) {
			ranges.push({ start: stops[i], end: stops[i + 1] });
		}
		return ranges;
	});

	function clampForIndex(hz: number, index: number): number {
		const self = options.frequencies[index];
		let lower = MIN_HZ;
		let upper = MAX_HZ;
		for (const f of options.frequencies) {
			if (f === self) continue;
			if (f < self && f + 1 > lower) lower = f + 1;
			if (f > self && f - 1 < upper) upper = f - 1;
		}
		return Math.max(lower, Math.min(upper, hz));
	}

	function pointerHz(clientX: number): number {
		if (!barEl) return MIN_HZ;
		const rect = barEl.getBoundingClientRect();
		const pct = ((clientX - rect.left) / rect.width) * 100;
		return pctToHz(pct);
	}

	function onBarPointerDown(ev: PointerEvent) {
		if (ev.button !== 0) return;
		if ((ev.target as HTMLElement).closest('.handle')) return;
		const hz = pointerHz(ev.clientX);
		let candidate = hz;
		const existing = new Set(options.frequencies);
		while (existing.has(candidate) && candidate < MAX_HZ) candidate++;
		if (candidate >= MAX_HZ) return;
		addFrequency(candidate);
	}

	function onHandlePointerDown(ev: PointerEvent, index: number) {
		if (ev.button !== 0) return;
		if ((ev.target as HTMLElement).closest('input, button')) return;
		ev.preventDefault();
		ev.stopPropagation();
		dragIndex = index;
		dragPointerId = ev.pointerId;
		window.addEventListener('pointermove', onWindowPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
		window.addEventListener('pointercancel', onWindowPointerUp);
	}

	function onWindowPointerMove(ev: PointerEvent) {
		if (dragIndex === null || ev.pointerId !== dragPointerId) return;
		const hz = clampForIndex(pointerHz(ev.clientX), dragIndex);
		options.frequencies[dragIndex] = hz;
	}

	function onWindowPointerUp(ev: PointerEvent) {
		if (ev.pointerId !== dragPointerId) return;
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
		window.removeEventListener('pointercancel', onWindowPointerUp);
		dragIndex = null;
		dragPointerId = null;
		options.frequencies = [...options.frequencies].sort((a, b) => a - b);
	}

	function onInputCommit(index: number, raw: string) {
		const hz = Number(raw);
		if (!Number.isFinite(hz) || !Number.isInteger(hz) || hz < MIN_HZ || hz > MAX_HZ) {
			editError = { index, msg: `${MIN_HZ}–${MAX_HZ}` };
			return;
		}
		if (options.frequencies.some((f, i) => i !== index && f === hz)) {
			editError = { index, msg: 'dup' };
			return;
		}
		editError = null;
		options.frequencies[index] = hz;
		options.frequencies = [...options.frequencies].sort((a, b) => a - b);
	}

	function onInputKey(ev: KeyboardEvent, index: number) {
		if (ev.key === 'Enter') {
			onInputCommit(index, (ev.currentTarget as HTMLInputElement).value);
			(ev.currentTarget as HTMLInputElement).blur();
		}
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

	<div class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<div class="text-gray-400 text-xs uppercase tracking-widest">Crossovers</div>
			<div class="text-gray-600 text-xs">Click bar to add · drag to move</div>
		</div>

		<div class="flex items-center gap-2 select-none">
			<span class="text-gray-600 text-xs tabular-nums">20</span>
			<!-- Spectrum area: pills above (y=0..24), bar (y=40..56), pills below (y=64..88) -->
			<div class="relative flex-1 h-24">
				<!-- Bar -->
				<div
					bind:this={barEl}
					onpointerdown={onBarPointerDown}
					role="slider"
					tabindex="-1"
					aria-label="Frequency spectrum, click to add a crossover"
					aria-valuemin={MIN_HZ}
					aria-valuemax={MAX_HZ}
					aria-valuenow={options.frequencies[0] ?? MIN_HZ}
					class="absolute left-0 right-0 top-10 h-4 bg-gray-800 border border-gray-700 cursor-crosshair"
				>
					<!-- Band fills -->
					{#each bandRanges as range, i (i)}
						{@const leftPct = hzToPct(range.start)}
						{@const widthPct = hzToPct(range.end) - leftPct}
						<div
							class="absolute top-0 bottom-0 {i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700/60'} pointer-events-none"
							style="left: {leftPct}%; width: {widthPct}%;"
						></div>
					{/each}

					{#if options.frequencies.length === 0}
						<div class="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 italic pointer-events-none">
							Click anywhere to add a split
						</div>
					{/if}
				</div>

				<!-- Handles -->
				{#each options.frequencies as hz, i (i)}
					{@const above = i % 2 === 0}
					{@const active = dragIndex === i || hoverIndex === i}
					{@const hasError = editError !== null && editError.index === i}
					<div
						class="handle absolute top-0 bottom-0 -translate-x-1/2 flex flex-col items-center"
						style="left: {hzToPct(hz)}%; z-index: {dragIndex === i ? 30 : hoverIndex === i ? 20 : 10};"
						onpointerenter={() => (hoverIndex = i)}
						onpointerleave={() => {
							if (hoverIndex === i) hoverIndex = null;
						}}
						role="presentation"
					>
						<!-- Vertical line through bar -->
						<div
							class="absolute top-8 h-8 w-px pointer-events-none {active ? 'bg-secondary-400' : 'bg-secondary-400/70'}"
						></div>
						<!-- Wide invisible drag hit area covering the bar slice -->
						<div
							class="absolute top-8 h-8 w-4 cursor-grab active:cursor-grabbing"
							onpointerdown={(e) => onHandlePointerDown(e, i)}
							role="presentation"
						></div>
						<!-- Pill (above or below the bar) -->
						<div
							class="absolute h-6 flex items-center gap-1 px-1 bg-gray-900 border cursor-grab active:cursor-grabbing {hasError ? 'border-danger-400 text-danger-400' : active ? 'border-secondary-400 text-secondary-400' : 'border-secondary-400/60 text-secondary-400'}"
							style="top: {above ? '4px' : '60px'};"
							onpointerdown={(e) => onHandlePointerDown(e, i)}
							role="presentation"
						>
							<input
								type="number"
								min={MIN_HZ}
								max={MAX_HZ}
								step="1"
								value={hz}
								onchange={(e) => onInputCommit(i, (e.currentTarget as HTMLInputElement).value)}
								onkeydown={(e) => onInputKey(e, i)}
								onpointerdown={(e) => e.stopPropagation()}
								class="w-10 bg-transparent text-[11px] text-gray-100 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-right"
								aria-label="Crossover frequency in Hz"
							/>
							<button
								class="text-gray-500 hover:text-secondary-400 text-[11px] leading-none"
								onclick={() => removeFrequency(options.frequencies[i])}
								onpointerdown={(e) => e.stopPropagation()}
								aria-label="Remove {hz} Hz"
							>✕</button>
						</div>
					</div>
				{/each}
			</div>
			<span class="text-gray-600 text-xs tabular-nums">20k</span>
		</div>
	</div>
</section>
