import { describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { activeChordIndex, breakColumn, chordTokens, wrapLine } from './song';
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
