<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SongSheet from '#lib/components/SongSheet.svelte';
	import SongEditor from '#lib/components/SongEditor.svelte';
	import ProgressBar from '#lib/components/ProgressBar.svelte';
	import { Player } from '#lib/player.svelte.ts';
	import { cacheSong } from '#lib/offline.ts';
	import { activeChordIndex, adjustSync, chordTokens, type Line } from '#lib/song.ts';
	import type { PageData } from './$types';
	import StatusSelect from '#lib/components/StatusSelect.svelte';
	import { setSongStatus } from '#lib/api.ts';

	let { data }: { data: PageData } = $props();
	const setlist = untrack(() => data.setlist);
	const id = untrack(() => data.song.id);

	let title = $state(untrack(() => data.song.title));
	let lines: Line[] = $state(untrack(() => structuredClone(data.song.lines)));
	let sync: number[] = $state(untrack(() => [...data.song.sync]));
	let hasAudio = $state(untrack(() => data.song.hasAudio));
	let audioId = $state(untrack(() => data.song.audioId));
	let status = $state(untrack(() => data.song.status));

	async function changeStatus(s: string | null) {
		const before = status;
		status = s;
		try {
			await setSongStatus(id, s);
		} catch (e) {
			status = before;
			alert(e instanceof Error ? e.message : e);
		}
	}

	const setlistHref = (pos: number, songId: string) =>
		resolve(`/songs/[id]?setlist=${setlist!.setlist.id}&pos=${pos}`, { id: songId });

	type Mode = 'view' | 'edit' | 'sync';
	let mode = $state<Mode>(page.url.searchParams.get('edit') ? 'edit' : 'view');
	let follow = $state(true);
	let showHelp = $state(false);

	const player = new Player();
	let audioEl: HTMLAudioElement | null = $state(null);
	$effect(() => {
		player.attach(audioEl);
	});

	// ---- layout: number of monospace columns that fit ----
	let sheetWidth = $state(800);
	let charWidth = $state(9.6);
	let measureEl: HTMLSpanElement;
	onMount(() => {
		// Drop ?edit=1 from the URL but keep the setlist context.
		if (page.url.searchParams.has('edit'))
			goto(setlist ? setlistHref(setlist.pos, id) : resolve('/songs/[id]', { id }), {
				shallow: true,
				replace: true
			});
		charWidth = measureEl.getBoundingClientRect().width / 10 || 9.6;
	});
	const cols = $derived(Math.max(16, Math.floor(sheetWidth / charWidth) - 5));

	// ---- chords & sync ----
	const tokens = $derived(chordTokens(lines));
	const validSync = $derived(sync.slice(0, tokens.length));
	let taps: number[] = $state([]);

	$effect(() => {
		if (!hasAudio && mode !== 'sync') {
			player.virtualDuration = Math.max(30, (validSync.at(-1) ?? 0) + 5);
		}
	});

	const active = $derived(
		mode === 'sync'
			? taps.length - 1
			: validSync.length
				? activeChordIndex(validSync, player.time)
				: -1
	);
	const next = $derived(mode === 'sync' ? taps.length : -1);

	let sheetEl: HTMLElement;
	$effect(() => {
		const target = active;
		if (!follow || !player.playing || target < 0 || mode === 'edit') return;
		sheetEl
			?.querySelector(`[data-chord="${target}"]`)
			?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	function startSync() {
		if (tokens.length === 0) return;
		mode = 'sync';
		taps = [];
		player.pause();
		if (!hasAudio) {
			player.extendable = true;
			player.virtualDuration = Math.max(30, validSync.at(-1) ?? 0);
		}
		player.seek(0);
		player.onended = finishSync;
		player.play();
		window.scrollTo({ top: 0 });
	}

	function finishSync() {
		player.pause();
		player.extendable = false;
		player.onended = null;
		if (taps.length > 0) {
			sync = [...taps];
			changed(false);
		}
		taps = [];
		mode = 'edit';
	}

	function tap() {
		taps.push(player.time);
		if (taps.length >= tokens.length) finishSync();
	}

	// ---- saving ----
	let saveState: 'saved' | 'unsaved' | 'saving' | 'error' | 'offline' = $state('saved');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;

	function payload() {
		return JSON.stringify({ title, lines, sync: sync.slice(0, tokens.length) });
	}

	async function save() {
		clearTimeout(saveTimer);
		if (!dirty) return;
		dirty = false;
		saveState = 'saving';
		try {
			const res = await fetch(`/api/songs/${id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: payload()
			});
			if (!res.ok) throw new Error(await res.text());
			cacheSong(await res.json()).catch(console.error);
			if (!dirty) saveState = 'saved';
		} catch (e) {
			console.error(e);
			dirty = true;
			saveState = navigator.onLine ? 'error' : 'offline';
		}
	}

	function scheduleSave() {
		dirty = true;
		saveState = 'unsaved';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 800);
	}

	function flushSave() {
		if (!dirty) return;
		clearTimeout(saveTimer);
		dirty = false;
		fetch(`/api/songs/${id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: payload(),
			keepalive: true
		});
	}

	beforeNavigate(flushSave);
	onDestroy(() => {
		flushSave();
		player.destroy();
	});

	// ---- undo / redo ----
	const snapshot = () => JSON.stringify({ title, lines, sync });
	let prevTokens = untrack(() => chordTokens(lines));
	let past: string[] = $state([]);
	let future: string[] = $state([]);
	let current = untrack(snapshot);
	let lastChange = 0;

	function changed(record = true) {
		// Keep timestamps attached to their chords; chords written during playback get the current time.
		sync = adjustSync(prevTokens, tokens, sync, player.playing ? player.time : null);
		prevTokens = tokens;
		if (record) {
			const now = Date.now();
			const snap = snapshot();
			if (snap === current) return;
			if (now - lastChange > 700) {
				past.push(current);
				if (past.length > 300) past.shift();
			}
			future = [];
			current = snap;
			lastChange = now;
		}
		scheduleSave();
	}

	function restore(snap: string) {
		const s = JSON.parse(snap);
		title = s.title;
		lines = s.lines;
		sync = s.sync;
		prevTokens = chordTokens(lines);
		current = snap;
		lastChange = 0;
		scheduleSave();
	}

	function undo() {
		const snap = past.pop();
		if (snap === undefined) return;
		future.push(snapshot());
		restore(snap);
	}

	function redo() {
		const snap = future.pop();
		if (snap === undefined) return;
		past.push(snapshot());
		restore(snap);
	}

	// ---- actions ----
	function toggleEdit() {
		if (mode === 'sync') finishSync();
		mode = mode === 'edit' ? 'view' : 'edit';
		if (mode === 'view') save();
	}

	let fileInput: HTMLInputElement;
	let uploading = $state(false);
	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		uploading = true;
		try {
			player.pause();
			const form = new FormData();
			form.append('file', file);
			const res = await fetch(`/api/songs/${id}/audio`, { method: 'POST', body: form });
			if (!res.ok) throw new Error(await res.text());
			hasAudio = true;
			audioId = (await res.json()).audioId;
		} catch (err) {
			alert(`Upload failed: ${err}`);
		} finally {
			uploading = false;
			fileInput.value = '';
		}
	}

	async function deleteSong() {
		if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
		dirty = false;
		await fetch(`/api/songs/${id}`, { method: 'DELETE' });
		await goto(resolve('/'));
	}

	function onkeydown(e: KeyboardEvent) {
		const inField = (e.target as HTMLElement)?.closest('input, textarea');
		const mod = e.ctrlKey || e.metaKey;
		if (mode === 'sync') {
			if (e.code === 'Space') {
				e.preventDefault();
				if (!e.repeat) tap();
			} else if (e.key === 'Backspace') {
				e.preventDefault();
				taps.pop();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				finishSync();
			}
			return;
		}
		if (mode === 'edit' && e.key === 'Escape') {
			e.preventDefault();
			(document.activeElement as HTMLElement | null)?.blur();
			toggleEdit();
		} else if (mode === 'edit' && mod && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
		} else if (mode === 'edit' && mod && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
		} else if (mode === 'edit' && mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			save();
		} else if (e.code === 'Space' && !inField && !(e.target as HTMLElement)?.closest('button')) {
			e.preventDefault();
			player.toggle();
		}
	}
</script>

<svelte:window {onkeydown} onbeforeunload={flushSave} ononline={save} />

{#if hasAudio}
	<audio bind:this={audioEl} src="/api/songs/{id}/audio?v={audioId}" preload="metadata"></audio>
{/if}

<header>
	<a class="back" href={resolve('/')} title="Back to overview">←</a>
	<div class="toolbar">
		<button class:on={mode === 'edit'} onclick={toggleEdit} disabled={mode === 'sync'}>
			{mode === 'edit' ? '✓ Done' : '✎ Edit'}
		</button>
		<label class="follow" title="Scroll along with playback">
			<input type="checkbox" bind:checked={follow} /> Follow
		</label>
		<button onclick={() => fileInput.click()} disabled={uploading || mode === 'sync'}>
			{uploading ? 'Uploading…' : '⇪ Upload Audio'}
		</button>
		<input type="file" accept="audio/*" hidden bind:this={fileInput} onchange={upload} />
		{#if mode === 'edit'}
			<span class="sep"></span>
			<button onclick={undo} disabled={past.length === 0} title="Undo (Ctrl+Z)">↶</button>
			<button onclick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)">↷</button>
			<button
				onclick={startSync}
				disabled={tokens.length === 0}
				title={tokens.length === 0 ? 'Write some chords first' : 'Tap Space for each chord'}
			>
				⏱ Sync
			</button>
			<button class:on={showHelp} onclick={() => (showHelp = !showHelp)} title="Editing help"
				>?</button
			>
			<StatusSelect value={status} statuses={data.statuses} onchange={changeStatus} />
			<button class="danger" onclick={deleteSong}>Delete</button>
		{:else if mode === 'sync'}
			<button class="primary" onclick={finishSync}>Finish sync</button>
		{/if}
		<span class="status {saveState}">
			{{
				saved: 'Saved',
				unsaved: 'Unsaved…',
				saving: 'Saving…',
				error: 'Save failed',
				offline: 'Offline: will save when back online'
			}[saveState]}
		</span>
	</div>
</header>

{#if setlist}
	<nav class="setlist-bar">
		<a class="setlist-name" href={resolve('/setlists/[id]', { id: setlist.setlist.id })}>
			☰ {setlist.setlist.name}
		</a>
		<span class="setlist-pos">{setlist.pos + 1} / {setlist.setlist.songIds.length}</span>
		<span class="spacer"></span>
		{#if setlist.prev}
			<a class="button" href={setlistHref(setlist.pos - 1, setlist.prev.id)} title="Previous song">
				← {setlist.prev.title}
			</a>
		{/if}
		{#if setlist.next}
			<a class="button" href={setlistHref(setlist.pos + 1, setlist.next.id)} title="Next song">
				Next: {setlist.next.title} →
			</a>
		{:else}
			<span class="setlist-end">Last song</span>
		{/if}
	</nav>
{/if}

<main bind:this={sheetEl}>
	{#if mode === 'edit'}
		<input
			class="title-input"
			bind:value={title}
			oninput={() => changed()}
			placeholder="Song title"
		/>
	{:else}
		<h1>{title || 'Untitled song'}</h1>
	{/if}

	{#if mode === 'sync'}
		<p class="hint">
			Press <kbd>Space</kbd> when chord <strong>{tokens[next]?.name}</strong> ({next +
				1}/{tokens.length}) starts. <kbd>Backspace</kbd> undoes the last tap, <kbd>Esc</kbd> finishes.
		</p>
	{:else if mode === 'edit' && showHelp}
		<p class="hint">
			Chords typed during playback get the current time as timestamp. Chord row types in overwrite
			mode. <kbd>Enter</kbd> splits a line, <kbd>Backspace</kbd> at the start joins lines,
			<kbd>↑</kbd>/<kbd>↓</kbd> move between rows. <kbd>Esc</kbd> leaves edit mode.
		</p>
	{:else if tokens.length > 0 && validSync.length < tokens.length && validSync.length > 0}
		<p class="hint">{tokens.length - validSync.length} chord(s) at the end are not synced yet.</p>
	{/if}

	<div class="sheet-wrap" bind:clientWidth={sheetWidth}>
		<span class="measure" bind:this={measureEl}>0000000000</span>
		{#if mode === 'edit'}
			<SongEditor bind:lines {cols} onchange={() => changed()} />
		{:else}
			<SongSheet
				{lines}
				{cols}
				{active}
				synced={validSync.length}
				onchordclick={mode === 'sync' ? undefined : (i) => player.seek(validSync[i])}
			/>
		{/if}
	</div>
</main>

<ProgressBar
	playing={player.playing}
	playDisabled={mode === 'sync'}
	ontoggle={() => player.toggle()}
	time={player.time}
	duration={player.duration}
	markers={mode === 'sync' ? taps : validSync}
	onseek={(t) => mode !== 'sync' && player.seek(t)}
/>

<style>
	.setlist-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding: 0.4rem 1rem;
		background: var(--input-focus);
		border-bottom: 1px solid var(--border);
		font-size: 0.9rem;
	}
	.setlist-name {
		font-weight: 600;
		color: var(--accent);
		text-decoration: none;
	}
	.setlist-pos,
	.setlist-end {
		color: var(--muted);
	}
	.spacer {
		flex: 1;
	}
	header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 1rem;
		background: var(--panel);
		border-bottom: 1px solid var(--border);
	}
	.back {
		font-size: 1.3rem;
		text-decoration: none;
		color: var(--fg);
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
	}
	.sep {
		width: 1px;
		height: 1.6rem;
		background: var(--border);
		margin: 0 0.3rem;
	}
	.follow {
		font-size: 0.9rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}
	.danger {
		color: var(--danger);
	}
	.status {
		margin-left: auto;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.status.error,
	.status.offline {
		color: var(--danger);
	}
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0.5rem 1.5rem 6rem;
	}
	h1,
	.title-input {
		font-size: 1.8rem;
		font-weight: 600;
		margin: 0.8rem 0;
	}
	.title-input {
		font-family: inherit;
		width: 100%;
		border: none;
		border-bottom: 1px dashed var(--border);
		background: transparent;
		color: inherit;
		padding: 0;
		outline: none;
	}
	.title-input:focus {
		border-bottom-color: var(--accent);
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
	kbd {
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0 0.3em;
		font-size: 0.85em;
	}
	.sheet-wrap {
		position: relative;
		font-family: var(--mono);
		font-size: 1rem;
	}
	.measure {
		position: absolute;
		visibility: hidden;
		white-space: pre;
		font-weight: bold;
	}
</style>
