<script lang="ts">
	import { sectionHue } from '#lib/song.ts';

	let {
		value,
		statuses,
		disabled = false,
		onchange
	}: {
		value: string | null;
		statuses: string[];
		disabled?: boolean;
		onchange: (status: string | null) => void;
	} = $props();

	// Keep a status that was removed from config.json selectable so it isn't silently lost.
	const options = $derived(value && !statuses.includes(value) ? [...statuses, value] : statuses);
	const hue = $derived(value ? sectionHue(value) : null);
</script>

<select
	class="status-select"
	class:empty={!value}
	style:--hue={hue}
	title="Song status"
	{disabled}
	value={value ?? ''}
	onchange={(e) => onchange(e.currentTarget.value || null)}
>
	<option value="">No status</option>
	{#each options as s (s)}
		<option value={s}>{s}</option>
	{/each}
</select>

<style>
	.status-select {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.2rem 0.4rem;
		border-radius: 999px;
		border: 1px solid hsl(var(--hue) 55% 50%);
		background: hsl(var(--hue) 70% 50% / 0.12);
		color: hsl(var(--hue) 60% 38%);
		cursor: pointer;
		max-width: 10rem;
	}
	@media (prefers-color-scheme: dark) {
		.status-select {
			color: hsl(var(--hue) 70% 72%);
		}
	}
	.status-select.empty {
		border-color: var(--border);
		background: var(--panel);
		color: var(--muted);
	}
	option {
		color: var(--fg);
		background: var(--panel);
	}
</style>
