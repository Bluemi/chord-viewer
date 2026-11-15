import { describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import {
	activeChordIndex,
	adjustSync,
	breakColumn,
	chordTokens,
	sectionHue,
	sectionHues,
	wrapLine
} from './song';
import { loginProof } from './sha256';

describe('chordTokens', () => {
	it('parses tokens in order', () => {
		const t = chordTokens([
			{ chords: 'C   G', text: '' },
			{ chords: '', text: 'x' },
			{ chords: '  Am7', text: '' }
		]);
		expect(t.map((x) => [x.line, x.col, x.name])).toEqual([
			[0, 0, 'C'],
			[0, 4, 'G'],
			[2, 2, 'Am7']
		]);
	});
});

describe('wrap', () => {
	it('does not break short lines', () => {
		expect(breakColumn({ chords: 'C', text: 'hello' }, 10)).toBeNull();
	});
	it('breaks after a space', () => {
		const segs = wrapLine({ chords: 'C         G', text: 'hello world again' }, 12);
		expect(segs[0].text).toBe('hello world ');
		expect(segs[1].text).toBe('again');
		expect(segs.map((s) => s.chords).join('')).toBe('C         G');
	});
});

describe('activeChordIndex', () => {
	it('finds last passed', () => {
		expect(activeChordIndex([1, 2, 3], 0.5)).toBe(-1);
		expect(activeChordIndex([1, 2, 3], 2.5)).toBe(1);
	});
});

describe('loginProof', () => {
	it('matches node crypto', () => {
		for (const pw of ['', 'secret', 'ü'.repeat(100)]) {
			const key = createHash('sha256').update(pw).digest();
			const expected = createHmac('sha256', key).update('nonce123').digest('hex');
			expect(loginProof(pw, 'nonce123')).toBe(expected);
		}
	});
});

describe('adjustSync', () => {
	const tk = (chords: string[]) => chordTokens(chords.map((c) => ({ chords: c, text: '' })));
	it('inserts current time for a new chord', () => {
		expect(adjustSync(tk(['C   G']), tk(['C D G']), [1, 3], 2)).toEqual([1, 2, 3]);
	});
	it('appends while playing, padding unsynced chords', () => {
		expect(adjustSync(tk(['C G']), tk(['C G A']), [1], 5)).toEqual([1, 1, 5]);
	});
	it('removes timestamp of deleted chord', () => {
		expect(adjustSync(tk(['C D G']), tk(['C   G']), [1, 2, 3], null)).toEqual([1, 3]);
	});
	it('keeps later timestamps when not playing', () => {
		expect(adjustSync(tk(['C   G']), tk(['C D G']), [1, 3], null)).toEqual([1, 1, 3]);
		expect(adjustSync(tk(['C']), tk(['C D']), [1], null)).toEqual([1]);
	});
});

describe('sections', () => {
	it('numbered sections share a color', () => {
		expect(sectionHue('Verse 1')).toBe(sectionHue('verse 2'));
		expect(sectionHue('Verse')).not.toBe(sectionHue('Chorus'));
	});
	it('sections run until the next one', () => {
		const h = sectionHues([
			{ chords: '', text: 'a' },
			{ chords: '', text: 'b', section: 'Verse' },
			{ chords: '', text: 'c' },
			{ chords: '', text: 'd', section: 'Chorus' }
		]);
		expect(h[0]).toBeNull();
		expect(h[2]).toBe(h[1]);
		expect(h[3]).toBe(sectionHue('Chorus'));
	});
});
