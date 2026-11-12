<script lang="ts">
	import { tick } from 'svelte';
	import { breakColumn, type Line } from '#lib/song.ts';

	type Row = 'chords' | 'text';

	let {
		lines = $bindable(),
		cols,
		onchange
	}: { lines: Line[]; cols: number; onchange: () => void } = $props();

	const els: Record<Row, HTMLInputElement[]> = $state({ chords: [], text: [] });

	async function focusAt(i: number, row: Row, col: number) {
		await tick();
		const el = els[row][i];
		if (!el) return;
		el.focus();
		el.setSelectionRange(col, col);
	}

	function update(i: number, row: Row, value: string, caret: number) {
		lines[i] = {
			...lines[i],
			[row]: row === 'chords' ? value.trimEnd().padEnd(Math.min(caret, value.length)) : value
		};
		// Auto-wrap: if the line no longer fits, move the overflow into a new line pair.
		const b = breakColumn(lines[i], cols);
		if (b !== null) {
			const l = lines[i];
			lines.splice(
				i,
				1,
				{ chords: l.chords.slice(0, b).trimEnd(), text: l.text.slice(0, b) },
				{
					chords: l.chords.slice(b),
					text: l.text.slice(b)
				}
			);
			if (caret >= b) focusAt(i + 1, row, caret - b);
			else focusAt(i, row, caret);
		} else {
			focusAt(i, row, caret);
		}
		onchange();
	}

	function oninput(i: number, row: Row, e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		update(i, row, el.value, el.selectionStart ?? el.value.length);
	}

	function onkeydown(i: number, row: Row, e: KeyboardEvent) {
		const el = e.currentTarget as HTMLInputElement;
		const c = el.selectionStart ?? 0;
		const noSel = el.selectionStart === el.selectionEnd;
		const v = el.value;
		const mod = e.ctrlKey || e.metaKey || e.altKey;

		if (e.key === 'Enter') {
			e.preventDefault();
			const l = lines[i];
			lines.splice(
				i,
				1,
				{ chords: l.chords.slice(0, c).trimEnd(), text: l.text.slice(0, c) },
				{
					chords: l.chords.slice(c),
					text: l.text.slice(c)
				}
			);
			focusAt(i + 1, row, 0);
			onchange();
		} else if (e.key === 'Backspace' && noSel && c === 0 && i > 0) {
			e.preventDefault();
			const prev = lines[i - 1];
			const cur = lines[i];
			const m = Math.max(prev.chords.length, prev.text.length);
			lines.splice(i - 1, 2, {
				chords: (prev.chords.padEnd(m) + cur.chords).trimEnd(),
				text: prev.text.padEnd(cur.text ? m : prev.text.length) + cur.text
			});
			focusAt(i - 1, row, m);
			onchange();
		} else if (e.key === 'Delete' && noSel && c >= v.length && i < lines.length - 1) {
			e.preventDefault();
			const cur = lines[i];
			const nxt = lines[i + 1];
			const m = Math.max(cur.chords.length, cur.text.length);
			lines.splice(i, 2, {
				chords: (cur.chords.padEnd(m) + nxt.chords).trimEnd(),
				text: cur.text.padEnd(nxt.text ? m : cur.text.length) + nxt.text
			});
			focusAt(i, row, c);
			onchange();
		} else if (row === 'chords' && e.key === 'Backspace' && noSel && c > 0 && !mod) {
			// Overwrite with a space so chords to the right keep their position.
			e.preventDefault();
			update(i, row, v.slice(0, c - 1) + ' ' + v.slice(c), c - 1);
		} else if (row === 'chords' && e.key.length === 1 && noSel && !mod) {
			// Overwrite mode for chords: typing replaces spaces instead of shifting chords right.
			e.preventDefault();
			const padded = v.padEnd(c);
			const rest = padded[c] === ' ' ? padded.slice(c + 1) : padded.slice(c);
			update(i, row, padded.slice(0, c) + e.key + rest, c + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (row === 'text') focusAt(i, 'chords', c);
			else if (i > 0) focusAt(i - 1, 'text', c);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (row === 'chords') focusAt(i, 'text', c);
			else if (i < lines.length - 1) focusAt(i + 1, 'chords', c);
		}
	}
</script>

<div class="editor">
	{#each lines as line, i (i)}
		<div class="pair">
			<div class="num">{i + 1}</div>
			<div class="rows" style:width="{cols + 1}ch">
				<input
					class="chords"
					bind:this={els.chords[i]}
					value={line.chords}
					placeholder={i === 0 && !line.chords ? 'chords…' : ''}
					spellcheck="false"
					autocomplete="off"
					oninput={(e) => oninput(i, 'chords', e)}
					onkeydown={(e) => onkeydown(i, 'chords', e)}
				/>
				<input
					class="text"
					bind:this={els.text[i]}
					value={line.text}
					placeholder={i === 0 && !line.text ? 'lyrics…' : ''}
					autocomplete="off"
					oninput={(e) => oninput(i, 'text', e)}
					onkeydown={(e) => onkeydown(i, 'text', e)}
				/>
			</div>
		</div>
	{/each}
</div>

<style>
	.editor {
		font-family: var(--mono);
	}
	.pair {
		display: flex;
		margin-top: 0.6rem;
	}
	.num {
		width: 4ch;
		flex: none;
		color: var(--muted);
		font-size: 0.8em;
		padding-top: 0.15em;
	}
	.rows {
		display: flex;
		flex-direction: column;
		max-width: 100%;
	}
	input {
		font: inherit;
		line-height: 1.45;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		color: inherit;
		width: 100%;
		outline: none;
		border-bottom: 1px dashed transparent;
	}
	input:hover {
		border-bottom-color: var(--border);
	}
	input:focus {
		background: var(--input-focus);
		border-bottom-color: var(--accent);
	}
	.chords {
		color: var(--chord);
		font-weight: bold;
	}
</style>
