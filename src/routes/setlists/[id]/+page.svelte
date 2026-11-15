<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import StatusSelect from '#lib/components/StatusSelect.svelte';
	import { setSongStatus } from '#lib/api.ts';
	import {
		downloadSetlist,
		offlineStates,
		offlineSupported,
		type OfflineState
	} from '#lib/offline.ts';
	import type { SongSummary } from '#lib/song.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const id = untrack(() => data.setlist.id);

	let name = $state(untrack(() => data.setlist.name));
	let songs: SongSummary[] = $state(untrack(() => data.songs));
	const byId = $derived(new Map(songs.map((s) => [s.id, s])));
	// Songs deleted after being added are dropped.
	let entries: string[] = $state(
		untrack(() => data.setlist.songIds.filter((sid) => data.songs.some((s) => s.id === sid)))
	);

	let online = $state(true);
	let supported = $state(false);
	let offline: Record<string, OfflineState> = $state({});
	onMount(() => {
		online = navigator.onLine;
		supported = offlineSupported();
		refreshOffline();
	});
	async function refreshOffline() {
		offline = await offlineStates(songs);
	}

	// ---- library filter ----
	let query = $state('');
	let statusFilter = $state('');
	const library = $derived(
		songs
			.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
			.filter(
				(s) => !statusFilter || (statusFilter === '-' ? !s.status : s.status === statusFilter)
			)
			.sort((a, b) => a.title.localeCompare(b.title))
	);
	const countIn = $derived(
		entries.reduce<Record<string, number>>((m, sid) => ((m[sid] = (m[sid] ?? 0) + 1), m), {})
	);

	// ---- saving ----
	let saveState: 'saved' | 'saving' | 'error' = $state('saved');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;

	function changed() {
		dirty = true;
		clearTimeout(timer);
		timer = setTimeout(save, 400);
	}

	async function save() {
		clearTimeout(timer);
		if (!dirty) return;
		dirty = false;
		saveState = 'saving';
		try {
			const res = await fetch(`/api/setlists/${id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, songIds: entries })
			});
			if (!res.ok) throw new Error(`${res.status}`);
			if (!dirty) saveState = 'saved';
		} catch {
			dirty = true;
			saveState = 'error';
		}
	}
	onDestroy(save);

	// ---- editing ----
	function add(sid: string, at = entries.length) {
		entries.splice(at, 0, sid);
		changed();
	}
	function removeAt(i: number) {
		entries.splice(i, 1);
		changed();
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= entries.length || from === to) return;
		const [sid] = entries.splice(from, 1);
		entries.splice(to, 0, sid);
		changed();
	}

	// Drag & drop: reorder within the setlist, or drag songs in from the library.
	type Drag = { from: 'set'; index: number } | { from: 'lib'; id: string };
	let drag: Drag | null = $state(null);
	let dropAt: number | null = $state(null);

	function dropIndex(e: DragEvent, i: number) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return e.clientY < r.top + r.height / 2 ? i : i + 1;
	}
	function onDragOver(e: DragEvent, i: number) {
		if (!drag) return;
		e.preventDefault();
		dropAt = dropIndex(e, i);
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		if (!drag || dropAt === null) return;
		if (drag.from === 'lib') add(drag.id, dropAt);
		else move(drag.index, dropAt > drag.index ? dropAt - 1 : dropAt);
		drag = null;
		dropAt = null;
	}

	async function changeStatus(sid: string, status: string | null) {
		try {
			const updated = await setSongStatus(sid, status);
			songs = songs.map((s) => (s.id === sid ? { ...s, status: updated.status } : s));
		} catch (e) {
			alert(e instanceof Error ? e.message : e);
		}
	}

	// ---- actions ----
	const songHref = (pos: number) =>
		resolve(`/songs/[id]?setlist=${id}&pos=${pos}`, { id: entries[pos] });

	async function play() {
		await save();
		if (entries.length) await goto(songHref(0));
	}

	let downloading: string | null = $state(null);
	async function downloadAll() {
		await save();
		try {
			await downloadSetlist(id, entries, (done, total) => (downloading = `${done}/${total}`));
		} catch (e) {
			alert(`Download failed: ${e instanceof Error ? e.message : e}`);
		} finally {
			downloading = null;
			await refreshOffline();
		}
	}
	const allOffline = $derived(
		entries.length > 0 && entries.every((sid) => offline[sid] === 'downloaded')
	);

	async function deleteSetlist() {
		if (!confirm(`Delete setlist "${name}"? The songs themselves are kept.`)) return;
		dirty = false;
		await fetch(`/api/setlists/${id}`, { method: 'DELETE' });
		await goto(resolve('/setlists'));
	}
</script>

<svelte:window
	ononline={() => {
		online = true;
		save();
	}}
	onoffline={() => (online = false)}
/>

<header>
	<a class="back" href={resolve('/setlists')} title="Back to setlists">←</a>
	<input
		class="name"
		bind:value={name}
		oninput={changed}
		placeholder="Setlist name"
		disabled={!online}
	/>
	<button class="primary" onclick={play} disabled={entries.length === 0}>▶ Play setlist</button>
	{#if supported}
		<button
			onclick={downloadAll}
			disabled={!online || entries.length === 0 || downloading !== null}
			title="Download all songs of this setlist for offline use"
		>
			{downloading ? `↓ ${downloading}` : allOffline ? '✓ Available offline' : '↓ Download all'}
		</button>
	{/if}
	<button class="danger" onclick={deleteSetlist} disabled={!online}>Delete</button>
	<span class="status">
		{!online
			? 'Offline (read-only)'
			: { saved: 'Saved', saving: 'Saving…', error: 'Save failed' }[saveState]}
	</span>
</header>

<div class="columns">
	<section class="setlist">
		<h2>Setlist <span class="muted">({entries.length} songs)</span></h2>
		<ol
			ondragover={(e) => {
				if (drag && entries.length === 0) {
					e.preventDefault();
					dropAt = 0;
				}
			}}
			ondrop={onDrop}
			ondragleave={(e) => {
				if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) dropAt = null;
			}}
		>
			{#each entries as sid, i (i + ':' + sid)}
				{@const song = byId.get(sid)}
				<li
					draggable={online}
					class:drop-before={dropAt === i}
					class:drop-after={dropAt === i + 1 && i === entries.length - 1}
					class:dragging={drag?.from === 'set' && drag.index === i}
					ondragstart={() => (drag = { from: 'set', index: i })}
					ondragend={() => ((drag = null), (dropAt = null))}
					ondragover={(e) => onDragOver(e, i)}
				>
					<span class="handle" title="Drag to reorder">⠿</span>
					<span class="pos">{i + 1}</span>
					<a class="title" href={songHref(i)}>{song?.title || 'Untitled song'}</a>
					{#if song?.status}<span class="badge">{song.status}</span>{/if}
					{#if supported && offline[sid] === 'downloaded'}
						<span class="offline-mark" title="Available offline">✓</span>
					{/if}
					<span class="row-actions">
						<button onclick={() => move(i, i - 1)} disabled={!online || i === 0} title="Move up"
							>↑</button
						>
						<button
							onclick={() => move(i, i + 1)}
							disabled={!online || i === entries.length - 1}
							title="Move down">↓</button
						>
						<button onclick={() => removeAt(i)} disabled={!online} title="Remove from setlist"
							>✕</button
						>
					</span>
				</li>
			{:else}
				<li class="placeholder" class:drop-before={dropAt === 0}>Add songs from your library →</li>
			{/each}
		</ol>
	</section>

	<section class="library">
		<h2>Library</h2>
		<div class="filters">
			<input type="search" bind:value={query} placeholder="Search songs…" />
			<select bind:value={statusFilter} title="Filter by status">
				<option value="">All statuses</option>
				<option value="-">No status</option>
				{#each data.statuses as s (s)}
					<option value={s}>{s}</option>
				{/each}
			</select>
		</div>
		<ul>
			{#each library as song (song.id)}
				<li
					draggable={online}
					ondragstart={() => (drag = { from: 'lib', id: song.id })}
					ondragend={() => ((drag = null), (dropAt = null))}
				>
					<span class="title">{song.title || 'Untitled song'}</span>
					{#if countIn[song.id]}
						<span class="in-set" title="Already in this setlist">
							in set{countIn[song.id] > 1 ? ` ×${countIn[song.id]}` : ''}
						</span>
					{/if}
					<StatusSelect
						value={song.status}
						statuses={data.statuses}
						disabled={!online}
						onchange={(s) => changeStatus(song.id, s)}
					/>
					<button onclick={() => add(song.id)} disabled={!online} title="Add to setlist">+</button>
				</li>
			{:else}
				<li class="muted">No matching songs.</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		background: var(--panel);
		border-bottom: 1px solid var(--border);
	}
	.back {
		font-size: 1.3rem;
		text-decoration: none;
		color: var(--fg);
	}
	input.name {
		flex: 1;
		min-width: 10rem;
		font: inherit;
		font-size: 1.3rem;
		font-weight: 600;
		border: none;
		border-bottom: 1px dashed var(--border);
		background: transparent;
		color: inherit;
		outline: none;
	}
	input.name:focus {
		border-bottom-color: var(--accent);
	}
	.danger {
		color: var(--danger);
	}
	.status {
		font-size: 0.85rem;
		color: var(--muted);
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.5rem 3rem;
	}
	@media (max-width: 800px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
	h2 {
		font-size: 1.05rem;
		margin: 0.5rem 0 0.75rem;
	}
	.muted {
		color: var(--muted);
		font-weight: normal;
	}
	ol,
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--panel);
		min-height: 3rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		border-top: 2px solid transparent;
		border-bottom: 1px solid var(--border);
	}
	li:last-child {
		border-bottom-color: transparent;
	}
	li.drop-before {
		border-top-color: var(--accent);
	}
	li.drop-after {
		border-bottom: 2px solid var(--accent);
	}
	li.dragging {
		opacity: 0.4;
	}
	li.placeholder {
		color: var(--muted);
		justify-content: center;
		padding: 1rem;
	}
	.handle {
		cursor: grab;
		color: var(--muted);
	}
	.pos {
		width: 2ch;
		text-align: right;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: inherit;
		text-decoration: none;
	}
	a.title:hover {
		color: var(--accent);
	}
	.badge {
		font-size: 0.75rem;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0 0.45rem;
	}
	.offline-mark {
		color: #2e7d32;
		font-size: 0.85rem;
	}
	.in-set {
		font-size: 0.75rem;
		color: var(--accent);
		white-space: nowrap;
	}
	.row-actions {
		display: flex;
		gap: 0.2rem;
	}
	.row-actions button,
	.library button {
		padding: 0.15rem 0.45rem;
	}
	.library li {
		cursor: grab;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}
	.filters input,
	.filters select {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--panel);
		color: var(--fg);
	}
	.filters input {
		flex: 1;
	}
</style>
