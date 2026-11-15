<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.appTitle}</title>
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--bg: #fafaf8;
		--fg: #1f2328;
		--muted: #8a8f98;
		--panel: #ffffff;
		--border: #dfe1e5;
		--accent: #2f6fde;
		--accent-fg: #fff;
		--chord: #c2410c;
		--hl: #fde68a;
		--input-focus: #eef4ff;
		--danger: #c62828;
		--mono: ui-monospace, 'JetBrains Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace;
		color-scheme: light dark;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #16181c;
			--fg: #e6e6e6;
			--muted: #7d828c;
			--panel: #1f2227;
			--border: #343841;
			--accent: #5b8ff9;
			--chord: #fb923c;
			--hl: #5b4a12;
			--input-focus: #1e2a40;
		}
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--fg);
		font-family: system-ui, sans-serif;
	}
	:global(button) {
		font: inherit;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--border);
		background: var(--panel);
		color: var(--fg);
		border-radius: 6px;
		cursor: pointer;
	}
	:global(button:hover:not(:disabled)) {
		border-color: var(--accent);
	}
	:global(button:disabled) {
		opacity: 0.45;
		cursor: default;
	}
	:global(button.primary) {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
	:global(button.on) {
		background: var(--input-focus);
		border-color: var(--accent);
	}
</style>
