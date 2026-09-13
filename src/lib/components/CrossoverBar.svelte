<script lang="ts">
	// The log-frequency spectrum strip. Interactive in the setup panel, static
	// when previewing a saved preset or another project's crossovers.

	type Props = {
		frequencies: number[];
		readonly?: boolean;
		onchange?: (frequencies: number[]) => void;
	};

	let { frequencies = $bindable(), readonly = false, onchange }: Props = $props();

	const MIN_HZ = 20;
	const MAX_HZ = 20000;
	const LOG_MIN = Math.log10(MIN_HZ);
	const LOG_SPAN = Math.log10(MAX_HZ) - LOG_MIN;

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
		const stops = [MIN_HZ, ...[...frequencies].sort((a, b) => a - b), MAX_HZ];
		return stops.slice(0, -1).map((start, i) => ({ start, end: stops[i + 1] }));
	});

	function commit(next: number[]): void {
		frequencies = next;
		onchange?.(next);
	}

	function clampForIndex(hz: number, index: number): number {
		const self = frequencies[index];
		let lower = MIN_HZ;
		let upper = MAX_HZ;
		for (const f of frequencies) {
			if (f === self) continue;
			if (f < self && f + 1 > lower) lower = f + 1;
			if (f > self && f - 1 < upper) upper = f - 1;
		}
		return Math.max(lower, Math.min(upper, hz));
	}

	function pointerHz(clientX: number): number {
		if (!barEl) return MIN_HZ;
		const rect = barEl.getBoundingClientRect();
		return pctToHz(((clientX - rect.left) / rect.width) * 100);
	}

	function onBarPointerDown(ev: PointerEvent) {
		if (readonly || ev.button !== 0) return;
		if ((ev.target as HTMLElement).closest('.handle')) return;
		let candidate = pointerHz(ev.clientX);
		const existing = new Set(frequencies);
		while (existing.has(candidate) && candidate < MAX_HZ) candidate++;
		if (candidate >= MAX_HZ) return;
		commit([...frequencies, candidate].sort((a, b) => a - b));
	}

	function onHandlePointerDown(ev: PointerEvent, index: number) {
		if (readonly || ev.button !== 0) return;
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
		const next = [...frequencies];
		next[dragIndex] = clampForIndex(pointerHz(ev.clientX), dragIndex);
		commit(next);
	}

	function onWindowPointerUp(ev: PointerEvent) {
		if (ev.pointerId !== dragPointerId) return;
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
		window.removeEventListener('pointercancel', onWindowPointerUp);
		dragIndex = null;
		dragPointerId = null;
		commit([...frequencies].sort((a, b) => a - b));
	}

	function onInputCommit(index: number, raw: string) {
		const hz = Number(raw);
		if (!Number.isFinite(hz) || !Number.isInteger(hz) || hz < MIN_HZ || hz > MAX_HZ) {
			editError = { index, msg: `${MIN_HZ}–${MAX_HZ}` };
			return;
		}
		if (frequencies.some((f, i) => i !== index && f === hz)) {
			editError = { index, msg: 'dup' };
			return;
		}
		editError = null;
		const next = [...frequencies];
		next[index] = hz;
		commit(next.sort((a, b) => a - b));
	}

	function onInputKey(ev: KeyboardEvent, index: number) {
		if (ev.key === 'Enter') {
			onInputCommit(index, (ev.currentTarget as HTMLInputElement).value);
			(ev.currentTarget as HTMLInputElement).blur();
		}
	}

	function remove(index: number) {
		commit(frequencies.filter((_, i) => i !== index));
	}
</script>

<div
	class="flex items-center gap-2 select-none"
	data-testid={readonly ? 'crossover-preview' : 'crossover-bar'}
>
	<span class="text-xs text-gray-600 tabular-nums">20</span>
	<!-- Spectrum area: pills above, bar in the middle, pills below -->
	<div class="relative flex-1 {readonly ? 'h-16' : 'h-24'}">
		<div
			bind:this={barEl}
			onpointerdown={onBarPointerDown}
			role={readonly ? 'presentation' : 'slider'}
			tabindex="-1"
			aria-label={readonly ? undefined : 'Frequency spectrum, click to add a crossover'}
			aria-valuemin={readonly ? undefined : MIN_HZ}
			aria-valuemax={readonly ? undefined : MAX_HZ}
			aria-valuenow={readonly ? undefined : (frequencies[0] ?? MIN_HZ)}
			class="absolute right-0 left-0 h-4 border border-gray-700 bg-gray-800 {readonly
				? 'top-6'
				: 'top-10 cursor-crosshair'}"
		>
			{#each bandRanges as range, i (i)}
				{@const leftPct = hzToPct(range.start)}
				<div
					class="absolute top-0 bottom-0 {i % 2 === 0
						? 'bg-gray-800'
						: 'bg-gray-700/60'} pointer-events-none"
					style="left: {leftPct}%; width: {hzToPct(range.end) - leftPct}%;"
				></div>
			{/each}

			{#if frequencies.length === 0 && !readonly}
				<div
					class="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 italic"
				>
					Click anywhere to add a split
				</div>
			{/if}
		</div>

		{#each frequencies as hz, i (i)}
			{@const above = i % 2 === 0}
			{@const active = dragIndex === i || hoverIndex === i}
			{@const hasError = editError !== null && editError.index === i}
			<div
				class="handle absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center"
				style="left: {hzToPct(hz)}%; z-index: {dragIndex === i ? 30 : hoverIndex === i ? 20 : 10};"
				onpointerenter={() => (hoverIndex = i)}
				onpointerleave={() => {
					if (hoverIndex === i) hoverIndex = null;
				}}
				role="presentation"
			>
				<div
					class="pointer-events-none absolute h-8 w-px {readonly ? 'top-4' : 'top-8'} {active
						? 'bg-secondary-400'
						: 'bg-secondary-400/70'}"
				></div>

				{#if readonly}
					<div
						class="absolute top-0 flex h-5 items-center border border-secondary-400/60 bg-gray-900 px-1 text-[11px] text-secondary-400 tabular-nums"
					>
						{hz}
					</div>
				{:else}
					<!-- Wide invisible drag hit area covering the bar slice -->
					<div
						class="absolute top-8 h-8 w-4 cursor-grab active:cursor-grabbing"
						onpointerdown={(e) => onHandlePointerDown(e, i)}
						role="presentation"
					></div>
					<div
						class="absolute flex h-6 cursor-grab items-center gap-1 border bg-gray-900 px-1 active:cursor-grabbing {hasError
							? 'border-danger-400 text-danger-400'
							: active
								? 'border-secondary-400 text-secondary-400'
								: 'border-secondary-400/60 text-secondary-400'}"
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
							class="w-10 [appearance:textfield] bg-transparent text-right text-[11px] text-gray-100 tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							aria-label="Crossover frequency in Hz"
						/>
						<button
							class="text-[11px] leading-none text-gray-500 hover:text-secondary-400"
							onclick={() => remove(i)}
							onpointerdown={(e) => e.stopPropagation()}
							aria-label="Remove {hz} Hz">✕</button
						>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	<span class="text-xs text-gray-600 tabular-nums">20k</span>
</div>
