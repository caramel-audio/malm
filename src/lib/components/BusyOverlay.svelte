<script lang="ts">
	// Covers its nearest positioned ancestor while a blocking redraw runs, so the
	// app never looks frozen.
	type Props = { label?: string };
	let { label = 'MALMING' }: Props = $props();
</script>

<div
	class="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/70 text-xs tracking-widest text-secondary-400 uppercase"
	role="status"
	aria-live="polite"
	data-testid="busy-overlay"
>
	{label}<span class="dots"><span>.</span><span>.</span><span>.</span></span>
</div>

<style>
	.dots span {
		animation: blink 1s step-start infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
</style>
