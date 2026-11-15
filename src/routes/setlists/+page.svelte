<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let creating = $state(false);
	let online = $state(true);
	onMount(() => (online = navigator.onLine));

	async function newSetlist() {
		creating = true;
		try {
			const res = await fetch('/api/setlists', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: 'New setlist' })
			});
			if (!res.ok) throw new Error(`${res.status}`);
			const sl = await res.json();
			await goto(resolve('/setlists/[id]', { id: sl.id }));
		} catch {
			alert('Could not create setlist. Are you offline?');
		} finally {
			creating = false;
		}
	}

	const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

<main>
	<header>
		<a class="back" href={resolve('/')} title="Back to songs">←</a>
		<h1>Setlists</h1>
		<button class="primary" onclick={newSetlist} disabled={creating || !online}>
			+ New setlist
		</button>
	</header>

	{#if data.setlists.length === 0}
		<p class="empty">No setlists yet.</p>
	{:else}
		<ul>
			{#each data.setlists as sl (sl.id)}
				<li>
					<a href={resolve('/setlists/[id]', { id: sl.id })}>
						<span class="name">{sl.name || 'Untitled setlist'}</span>
						<span class="count">{sl.songIds.length} songs</span>
						<span class="date">{fmt.format(sl.updatedAt)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 1rem;
	}
	header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	header h1 {
		flex: 1;
	}
	.back {
		font-size: 1.3rem;
		text-decoration: none;
		color: var(--fg);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--panel);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	a:not(.back) {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.8rem 1rem;
		color: inherit;
		text-decoration: none;
	}
	a:not(.back):hover {
		background: var(--input-focus);
	}
	.name {
		flex: 1;
		font-weight: 500;
	}
	.count,
	.date {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.empty {
		color: var(--muted);
		text-align: center;
		margin-top: 3rem;
	}
</style>
