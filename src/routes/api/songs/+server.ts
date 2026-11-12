import { json } from '@sveltejs/kit';
import { createSong, listSongs } from '#lib/server/db.ts';

export const GET = () => json(listSongs());

export const POST = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const title =
		typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled song';
	return json(createSong(title), { status: 201 });
};
