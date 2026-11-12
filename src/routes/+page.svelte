<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let creating = $state(false);

	async function newSong() {
		creating = true;
		try {
			const res = await fetch('/api/songs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'Untitled song' })
			});
			const song = await res.json();
			await goto(resolve('/songs/[id]?edit=1', { id: song.id }));
		} finally {
			creating = false;
		}
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await goto(resolve('/login'));
	}

	const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<main>
	<header>
		<h1>Songs</h1>
		<div class="actions">
			<button class="primary" onclick={newSong} disabled={creating}>+ New song</button>
			<button onclick={logout}>Log out</button>
		</div>
	</header>

	{#if data.songs.length === 0}
		<p class="empty">No songs yet. Create your first one!</p>
	{:else}
		<ul>
			{#each data.songs as song (song.id)}
				<li>
					<a href={resolve('/songs/[id]', { id: song.id })}>
						<span class="title">{song.title || 'Untitled song'}</span>
						{#if song.hasAudio}<span class="badge" title="Has audio">♪</span>{/if}
						<span class="date">{fmt.format(song.updatedAt)}</span>
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
		justify-content: space-between;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
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
	a {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.8rem 1rem;
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		background: var(--input-focus);
	}
	.title {
		flex: 1;
		font-weight: 500;
	}
	.badge {
		color: var(--accent);
	}
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
