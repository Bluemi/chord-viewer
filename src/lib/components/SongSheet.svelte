<script lang="ts">
	import { chordTokens, sectionHues, wrapLine, type Line } from '#lib/song.ts';

	let {
		lines,
		cols,
		active = -1,
		synced = 0,
		onchordclick
	}: {
		lines: Line[];
		cols: number;
		active?: number;
		/** number of chords (from the start) that have timestamps */
		synced?: number;
		onchordclick?: (index: number) => void;
	} = $props();

	const tokens = $derived(chordTokens(lines));
	const tokenAt = $derived(new Map(tokens.map((t) => [`${t.line}:${t.col}`, t.index])));
	const hues = $derived(sectionHues(lines));

	/** [start, end) text range of the active chord */
	const activeRange = $derived.by(() => {
		const t = tokens[active];
		if (!t) return null;
		const nxt = tokens[active + 1];
		const end = nxt && nxt.line === t.line ? nxt.col : Infinity;
		return { line: t.line, start: t.col, end };
	});

	function chordParts(chords: string) {
		return Array.from(chords.matchAll(/(\s+)|(\S+)/g), (m) => ({
			s: m[0],
			col: m.index!,
			chord: !!m[2]
		}));
	}

	function textParts(lineIdx: number, start: number, text: string) {
		const r = activeRange;
		if (!r || r.line !== lineIdx) return [{ s: text, hl: false }];
		const a = Math.max(0, r.start - start);
		const b = Math.max(0, Math.min(text.length, r.end - start));
		if (a >= text.length || b <= a) return [{ s: text, hl: false }];
		return [
			{ s: text.slice(0, a), hl: false },
			{ s: text.slice(a, b), hl: true },
			{ s: text.slice(b), hl: false }
		];
	}
</script>

<div class="sheet">
	{#each lines as line, i (i)}
		<div
			class="line"
			class:in-section={hues[i] !== null}
			class:section-start={line.section !== undefined}
			style:--hue={hues[i]}
		>
			{#if line.section !== undefined}
				<div class="section-name">{line.section || 'Section'}</div>
			{/if}
			{#each wrapLine(line, cols) as seg, j (j)}
				<div class="pair" class:cont={j > 0}>
					<div class="num">{j === 0 ? i + 1 : ''}</div>
					<div class="rows">
						<div class="chords">
							{#each chordParts(seg.chords) as p, k (k)}
								{#if p.chord}
									{@const idx = tokenAt.get(`${i}:${seg.start + p.col}`) ?? -1}
									<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
									<span
										class="chord"
										class:active={idx === active}
										class:synced={onchordclick && idx >= 0 && idx < synced}
										onclick={() => onchordclick && idx >= 0 && idx < synced && onchordclick(idx)}
										data-chord={idx}>{p.s}</span
									>
								{:else}<span>{p.s}</span>{/if}
							{/each}
						</div>
						<div class="text">
							{#each textParts(i, seg.start, seg.text) as p, k (k)}
								{#if p.hl}<mark>{p.s}</mark>{:else}<span>{p.s}</span>{/if}
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.sheet {
		font-family: var(--mono);
	}
	.line {
		display: flow-root;
		border-left: 4px solid transparent;
		padding: 0 0.6rem 0.3rem;
	}
	.line.in-section {
		border-left-color: hsl(var(--hue) 65% 52%);
		background: hsl(var(--hue) 70% 50% / 0.07);
	}
	.line.section-start {
		margin-top: 1rem;
		border-top-right-radius: 6px;
	}
	.section-name {
		font:
			600 0.8rem system-ui,
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--hue) 60% 45%);
		padding-top: 0.5rem;
	}
	.pair {
		display: flex;
		margin-top: 0.6rem;
	}
	.pair.cont {
		margin-top: 0.1rem;
	}
	.num {
		width: 4ch;
		flex: none;
		color: var(--muted);
		font-size: 0.8em;
		padding-top: 0.15em;
	}
	.rows {
		min-width: 1ch;
		line-height: 1.45;
	}
	.chords,
	.text {
		display: flex;
		min-height: 1.45em;
	}
	.chords {
		color: var(--chord);
		font-weight: bold;
	}
	.chord.synced {
		cursor: pointer;
	}
	.chord.synced:hover:not(.active) {
		background: var(--input-focus);
	}
	.chord {
		border-radius: 3px;
		transition: background 0.1s;
	}
	.chord.active {
		background: var(--accent);
		color: var(--accent-fg);
	}
	.chords > *,
	.text > * {
		white-space: pre;
	}
	mark {
		background: var(--hl);
		color: inherit;
		border-radius: 3px;
	}
</style>
