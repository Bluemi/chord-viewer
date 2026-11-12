import { error, json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { audioDir } from '#lib/server/config.ts';
import { deleteSong, getSong, getSongRow, updateSong } from '#lib/server/db.ts';
import type { Line } from '#lib/song.ts';

export const GET = ({ params }) => {
	const song = getSong(params.id);
	if (!song) error(404, 'Song not found');
	return json(song);
};

function isLines(v: unknown): v is Line[] {
	return (
		Array.isArray(v) &&
		v.every((l) => l && typeof l.chords === 'string' && typeof l.text === 'string')
	);
}

export const PUT = async ({ params, request }) => {
	const body = await request.json();
	const patch: { title?: string; lines?: Line[]; sync?: number[] } = {};
	if (typeof body.title === 'string') patch.title = body.title;
	if (body.lines !== undefined) {
		if (!isLines(body.lines)) error(400, 'Invalid lines');
		patch.lines = body.lines.map((l: Line) => ({ chords: l.chords, text: l.text }));
	}
	if (body.sync !== undefined) {
		if (!Array.isArray(body.sync) || !body.sync.every((t: unknown) => typeof t === 'number'))
			error(400, 'Invalid sync');
		patch.sync = body.sync;
	}
	const song = updateSong(params.id, patch);
	if (!song) error(404, 'Song not found');
	return json(song);
};

export const DELETE = ({ params }) => {
	const row = getSongRow(params.id);
	if (!row) error(404, 'Song not found');
	if (row.audio_file) fs.rmSync(path.join(audioDir, row.audio_file), { force: true });
	deleteSong(params.id);
	return json({ ok: true });
};
