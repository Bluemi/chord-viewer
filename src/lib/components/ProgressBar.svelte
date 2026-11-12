<script lang="ts">
	import { formatTime } from '#lib/player.svelte.ts';

	let {
		time,
		duration,
		markers = [],
		onseek
	}: { time: number; duration: number; markers?: number[]; onseek: (t: number) => void } = $props();

	let bar: HTMLDivElement;
	let dragging = false;

	const pct = $derived(duration > 0 ? Math.min(100, (time / duration) * 100) : 0);

	function seekFromEvent(e: PointerEvent) {
		const r = bar.getBoundingClientRect();
		const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
		onseek(f * duration);
	}
</script>

<div class="progress">
	<span class="time">{formatTime(time)}</span>
	<div
		class="bar"
		bind:this={bar}
		role="slider"
		tabindex="-1"
		aria-label="Playback position"
		aria-valuemin={0}
		aria-valuemax={duration}
		aria-valuenow={time}
		onpointerdown={(e) => {
			dragging = true;
			bar.setPointerCapture(e.pointerId);
			seekFromEvent(e);
		}}
		onpointermove={(e) => dragging && seekFromEvent(e)}
		onpointerup={() => (dragging = false)}
	>
		<div class="fill" style:width="{pct}%"></div>
		{#each markers as m, i (i)}
			{#if duration > 0}
				<div class="marker" style:left="{(m / duration) * 100}%"></div>
			{/if}
		{/each}
	</div>
	<span class="time">{formatTime(duration)}</span>
</div>

<style>
	.progress {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		background: var(--panel);
		border-top: 1px solid var(--border);
		z-index: 10;
	}
	.time {
		font-variant-numeric: tabular-nums;
		font-size: 0.85rem;
		color: var(--muted);
		min-width: 3em;
		text-align: center;
	}
	.bar {
		position: relative;
		flex: 1;
		height: 10px;
		background: var(--border);
		border-radius: 5px;
		cursor: pointer;
		touch-action: none;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--accent);
		border-radius: 5px;
		pointer-events: none;
	}
	.marker {
		position: absolute;
		top: -3px;
		bottom: -3px;
		width: 1px;
		background: var(--fg);
		opacity: 0.35;
		pointer-events: none;
	}
</style>
