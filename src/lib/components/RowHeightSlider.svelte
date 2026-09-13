<script lang="ts">
	type Props = {
		value: number;
		min: number;
		max: number;
	};

	let { value = $bindable(), min, max }: Props = $props();
</script>

<div>
	<div class="mb-1.5 flex items-baseline justify-between gap-2">
		<span class="text-xs tracking-widest text-gray-500 uppercase">Row height</span>
		<span class="font-mono text-xs text-gray-500">{value}</span>
	</div>
	<input
		type="range"
		{min}
		{max}
		step="10"
		bind:value
		aria-label="Row height in pixels"
		class="w-full accent-secondary-400"
	/>
</div>
