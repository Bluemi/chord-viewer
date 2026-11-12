<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SongSheet from '#lib/components/SongSheet.svelte';
	import SongEditor from '#lib/components/SongEditor.svelte';
	import ProgressBar from '#lib/components/ProgressBar.svelte';
	import { Player } from '#lib/player.svelte.ts';
	import { activeChordIndex, chordTokens, type Line } from '#lib/song.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const id = untrack(() => data.song.id);

	let title = $state(untrack(() => data.song.title));
	let lines: Line[] = $state(untrack(() => structuredClone(data.song.lines)));
	let sync: number[] = $state(untrack(() => [...data.song.sync]));
	let hasAudio = $state(untrack(() => data.song.hasAudio));
	let audioVersion = $state(0);

	type Mode = 'view' | 'edit' | 'sync';
	let mode = $state<Mode>(page.url.searchParams.get('edit') ? 'edit' : 'view');
	let follow = $state(true);

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
		if (page.url.searchParams.has('edit')) replaceState(resolve('/songs/[id]', { id }), {});
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
		const target = mode === 'sync' ? next : active;
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
	let saveState: 'saved' | 'unsaved' | 'saving' | 'error' = $state('saved');
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
			if (!dirty) saveState = 'saved';
		} catch (e) {
			console.error(e);
			dirty = true;
			saveState = 'error';
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
	const snapshot = () => JSON.stringify({ title, lines });
	let past: string[] = $state([]);
	let future: string[] = $state([]);
	let current = untrack(snapshot);
	let lastChange = 0;

	function changed(record = true) {
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
			audioVersion++;
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
		if (mode === 'edit' && mod && e.key.toLowerCase() === 'z') {
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

<svelte:window {onkeydown} onbeforeunload={flushSave} />

{#if hasAudio}
	<audio bind:this={audioEl} src="/api/songs/{id}/audio?v={audioVersion}" preload="metadata"
	></audio>
{/if}

<header>
	<a class="back" href={resolve('/')} title="Back to overview">←</a>
	<div class="toolbar">
		<button class:on={mode === 'edit'} onclick={toggleEdit} disabled={mode === 'sync'}>
			{mode === 'edit' ? '✓ Done' : '✎ Edit'}
		</button>
		<button onclick={() => player.toggle()} disabled={mode === 'sync'}>
			{player.playing ? '❚❚ Pause' : '▶ Play'}
		</button>
		<label class="follow" title="Scroll along with playback">
			<input type="checkbox" bind:checked={follow} /> Follow
		</label>
		<button onclick={() => fileInput.click()} disabled={uploading || mode === 'sync'}>
			{uploading ? 'Uploading…' : hasAudio ? '⇪ Replace audio' : '⇪ Upload audio'}
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
			<button class="danger" onclick={deleteSong}>Delete</button>
		{:else if mode === 'sync'}
			<button class="primary" onclick={finishSync}>Finish sync</button>
		{/if}
		<span class="status {saveState}">
			{{ saved: 'Saved', unsaved: 'Unsaved…', saving: 'Saving…', error: 'Save failed' }[saveState]}
		</span>
	</div>
</header>

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
	{:else if mode === 'edit'}
		<p class="hint">
			Chord row types in overwrite mode. <kbd>Enter</kbd> splits a line, <kbd>Backspace</kbd> at the
			start joins lines, <kbd>↑</kbd>/<kbd>↓</kbd> move between rows.
		</p>
	{:else if tokens.length > 0 && validSync.length < tokens.length && validSync.length > 0}
		<p class="hint">{tokens.length - validSync.length} chord(s) at the end are not synced yet.</p>
	{/if}

	<div class="sheet-wrap" bind:clientWidth={sheetWidth}>
		<span class="measure" bind:this={measureEl}>0000000000</span>
		{#if mode === 'edit'}
			<SongEditor bind:lines {cols} onchange={() => changed()} />
		{:else}
			<SongSheet {lines} {cols} {active} {next} />
		{/if}
	</div>
</main>

<ProgressBar
	time={player.time}
	duration={player.duration}
	markers={mode === 'sync' ? taps : validSync}
	onseek={(t) => mode !== 'sync' && player.seek(t)}
/>

<style>
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
	.status.error {
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
