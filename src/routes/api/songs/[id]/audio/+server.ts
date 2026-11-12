import { error, json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { audioDir } from '#lib/server/config.ts';
import { getSongRow, setAudio } from '#lib/server/db.ts';

export const POST = async ({ params, request }) => {
	const row = getSongRow(params.id);
	if (!row) error(404, 'Song not found');
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) error(400, 'No file uploaded');
	if (file.type && !file.type.startsWith('audio/') && !file.type.startsWith('video/'))
		error(400, 'Not an audio file');
	const ext = (path.extname(file.name).replace(/[^.\w]/g, '') || '.bin').toLowerCase();
	const name = `${row.id}-${Date.now()}${ext}`;
	fs.writeFileSync(path.join(audioDir, name), Buffer.from(await file.arrayBuffer()));
	if (row.audio_file) fs.rmSync(path.join(audioDir, row.audio_file), { force: true });
	setAudio(row.id, name, file.type || 'application/octet-stream');
	return json({ ok: true });
};

export const GET = ({ params, request }) => {
	const row = getSongRow(params.id);
	if (!row?.audio_file) error(404, 'No audio');
	const file = path.join(audioDir, row.audio_file);
	if (!fs.existsSync(file)) error(404, 'Audio file missing');
	const size = fs.statSync(file).size;
	const headers: Record<string, string> = {
		'Content-Type': row.audio_mime ?? 'application/octet-stream',
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'private, max-age=0'
	};
	const range = request.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
	if (range && (range[1] || range[2])) {
		let start: number, end: number;
		if (range[1]) {
			start = +range[1];
			end = range[2] ? Math.min(+range[2], size - 1) : size - 1;
		} else {
			start = Math.max(0, size - +range[2]);
			end = size - 1;
		}
		if (start > end || start >= size) {
			return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
		}
		const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
		return new Response(stream, {
			status: 206,
			headers: {
				...headers,
				'Content-Range': `bytes ${start}-${end}/${size}`,
				'Content-Length': String(end - start + 1)
			}
		});
	}
	const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
	return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
};
