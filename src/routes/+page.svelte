<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		downloadSong,
		offlineStates,
		offlineSupported,
		removeDownload,
		type OfflineState
	} from '#lib/offline.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let creating = $state(false);
	let online = $state(true);
	let supported = $state(false);
	let states: Record<string, OfflineState> = $state({});
	/** song id -> download progress 0..1 */
	let progress: Record<string, number> = $state({});

	async function refreshStates() {
		states = await offlineStates(data.songs);
	}

	onMount(() => {
		online = navigator.onLine;
		supported = offlineSupported();
		refreshStates();
	});

	async function newSong() {
		creating = true;
		try {
			const res = await fetch('/api/songs', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'Untitled song' })
			});
			if (!res.ok) throw new Error(`${res.status}`);
			const song = await res.json();
			await goto(resolve('/songs/[id]?edit=1', { id: song.id }));
		} catch {
			alert('Could not create song. Are you offline?');
		} finally {
			creating = false;
		}
	}

	async function download(id: string) {
		progress[id] = 0;
		try {
			await downloadSong(id, (p) => (progress[id] = p));
		} catch (e) {
			alert(`Download failed: ${e instanceof Error ? e.message : e}`);
		} finally {
			delete progress[id];
			await refreshStates();
		}
	}

	async function remove(id: string, title: string) {
		if (!confirm(`Remove the offline copy of "${title}"?`)) return;
		await removeDownload(id);
		await refreshStates();
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await goto(resolve('/login'));
	}

	const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

<main>
	<header>
		<h1>Songs</h1>
		<div class="actions">
			<button class="primary" onclick={newSong} disabled={creating || !online}>+ New song</button>
			<button onclick={logout} disabled={!online}>Log out</button>
		</div>
	</header>

	{#if !online}
		<p class="offline">You are offline. Only downloaded songs (✓) can be opened.</p>
	{/if}

	{#if data.songs.length === 0}
		<p class="empty">No songs yet. Create your first one!</p>
	{:else}
		<ul>
			{#each data.songs as song (song.id)}
				{@const state = states[song.id] ?? 'none'}
				<li class:unavailable={!online && state === 'none'}>
					<a href={resolve('/songs/[id]', { id: song.id })}>
						<span class="title">{song.title || 'Untitled song'}</span>
						{#if song.hasAudio}<span class="badge" title="Has audio">♪</span>{/if}
						<span class="date">{fmt.format(song.updatedAt)}</span>
					</a>
					{#if supported}
						{#if progress[song.id] !== undefined}
							<button class="dl" disabled>{Math.round(progress[song.id] * 100)}%</button>
						{:else if state === 'downloaded'}
							<button
								class="dl done"
								title="Available offline. Click to remove the offline copy."
								onclick={() => remove(song.id, song.title)}>✓</button
							>
						{:else if state === 'stale'}
							<button
								class="dl stale"
								title="Offline copy is outdated. Click to update."
								disabled={!online}
								onclick={() => download(song.id)}>↻</button
							>
						{:else}
							<button
								class="dl"
								title="Download for offline use"
								disabled={!online}
								onclick={() => download(song.id)}>↓</button
							>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
		{#if !supported}
			<p class="hint">
				Offline downloads need HTTPS (or localhost), because browsers only allow offline storage on
				secure origins.
			</p>
		{/if}
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
	li {
		display: flex;
		align-items: center;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	li.unavailable {
		opacity: 0.45;
	}
	a {
		flex: 1;
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
	.dl {
		width: 2.6rem;
		margin-right: 0.6rem;
		padding: 0.3rem 0;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		flex: none;
	}
	.dl.done {
		color: #2e7d32;
		border-color: currentColor;
	}
	.dl.stale {
		color: #b26a00;
		border-color: currentColor;
	}
	.offline {
		background: var(--hl);
		padding: 0.5rem 0.8rem;
		border-radius: 6px;
	}
	.hint {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.empty {
		color: var(--muted);
		text-align: center;
		margin-top: 3rem;
	}
</style>
