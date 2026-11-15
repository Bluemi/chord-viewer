import Database from 'better-sqlite3';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import type { Line, Song, SongSummary } from '#lib/song.ts';

export const db = new Database(path.join(config.dataDir, 'chord-viewer.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS songs (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	lines_json TEXT NOT NULL,
	sync_json TEXT NOT NULL DEFAULT '[]',
	audio_file TEXT,
	audio_mime TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token TEXT PRIMARY KEY,
	expires_at INTEGER NOT NULL
);
`);

interface Row {
	id: string;
	title: string;
	lines_json: string;
	sync_json: string;
	audio_file: string | null;
	audio_mime: string | null;
	created_at: number;
	updated_at: number;
}

function toSong(r: Row): Song {
	return {
		id: r.id,
		title: r.title,
		lines: JSON.parse(r.lines_json),
		sync: JSON.parse(r.sync_json),
		hasAudio: !!r.audio_file,
		audioId: r.audio_file,
		createdAt: r.created_at,
		updatedAt: r.updated_at
	};
}

export function listSongs(): SongSummary[] {
	const rows = db
		.prepare('SELECT id, title, updated_at, audio_file FROM songs ORDER BY updated_at DESC')
		.all() as Row[];
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		updatedAt: r.updated_at,
		hasAudio: !!r.audio_file,
		audioId: r.audio_file
	}));
}

export function getSongRow(id: string): Row | undefined {
	return db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Row | undefined;
}

export function getSong(id: string): Song | undefined {
	const r = getSongRow(id);
	return r && toSong(r);
}

export function createSong(title: string): Song {
	const id = randomUUID();
	const now = Date.now();
	db.prepare(
		'INSERT INTO songs (id, title, lines_json, sync_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
	).run(id, title, JSON.stringify([{ chords: '', text: '' }]), '[]', now, now);
	return getSong(id)!;
}

export function updateSong(
	id: string,
	patch: { title?: string; lines?: Line[]; sync?: number[] }
): Song | undefined {
	const cur = getSongRow(id);
	if (!cur) return undefined;
	db.prepare(
		'UPDATE songs SET title = ?, lines_json = ?, sync_json = ?, updated_at = ? WHERE id = ?'
	).run(
		patch.title ?? cur.title,
		patch.lines ? JSON.stringify(patch.lines) : cur.lines_json,
		patch.sync ? JSON.stringify(patch.sync) : cur.sync_json,
		Date.now(),
		id
	);
	return getSong(id);
}

export function setAudio(id: string, file: string, mime: string) {
	db.prepare('UPDATE songs SET audio_file = ?, audio_mime = ?, updated_at = ? WHERE id = ?').run(
		file,
		mime,
		Date.now(),
		id
	);
}

export function deleteSong(id: string) {
	db.prepare('DELETE FROM songs WHERE id = ?').run(id);
}
