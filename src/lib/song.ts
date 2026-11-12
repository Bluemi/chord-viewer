export interface Line {
	chords: string;
	text: string;
}

export interface Song {
	id: string;
	title: string;
	lines: Line[];
	/** sync[i] = timestamp (seconds) of the i-th chord token in reading order */
	sync: number[];
	hasAudio: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface SongSummary {
	id: string;
	title: string;
	updatedAt: number;
	hasAudio: boolean;
}

export interface ChordToken {
	index: number;
	line: number;
	col: number;
	name: string;
}

export function chordTokens(lines: Line[]): ChordToken[] {
	const out: ChordToken[] = [];
	lines.forEach((l, line) => {
		for (const m of l.chords.matchAll(/\S+/g)) {
			out.push({ index: out.length, line, col: m.index!, name: m[0] });
		}
	});
	return out;
}

/** Index of the chord active at `time` (last chord whose timestamp <= time), or -1. */
export function activeChordIndex(sync: number[], time: number): number {
	let idx = -1;
	for (let i = 0; i < sync.length; i++) {
		if (sync[i] <= time) idx = i;
		else break;
	}
	return idx;
}

/**
 * Column at which to break a line pair so it fits into `width` characters.
 * Prefers breaking after a space in the text without splitting a chord.
 * Returns null if no break is needed.
 */
export function breakColumn(line: Line, width: number): number | null {
	const len = Math.max(line.chords.length, line.text.length);
	if (width <= 0 || len <= width) return null;
	const chordOk = (b: number) =>
		b >= line.chords.length || line.chords[b] === ' ' || line.chords[b - 1] === ' ';
	for (let b = width; b > width / 3; b--) {
		const textOk = b >= line.text.length || line.text[b - 1] === ' ';
		if (textOk && chordOk(b)) return b;
	}
	for (let b = width; b > width / 3; b--) if (chordOk(b)) return b;
	return width;
}

export interface Segment {
	start: number;
	chords: string;
	text: string;
}

/** Split a line visually into segments of at most `width` columns. */
export function wrapLine(line: Line, width: number): Segment[] {
	const segs: Segment[] = [];
	let rest = line;
	let start = 0;
	for (let guard = 0; guard < 1000; guard++) {
		const b = breakColumn(rest, width);
		if (b === null) {
			segs.push({ start, ...rest });
			break;
		}
		segs.push({ start, chords: rest.chords.slice(0, b), text: rest.text.slice(0, b) });
		rest = { chords: rest.chords.slice(b), text: rest.text.slice(b) };
		start += b;
	}
	return segs;
}

export function newLine(): Line {
	return { chords: '', text: '' };
}
