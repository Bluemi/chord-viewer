import { json } from '@sveltejs/kit';
import { createSetlist, listSetlists } from '#lib/server/db.ts';

export const GET = () => json(listSetlists());

export const POST = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New setlist';
	return json(createSetlist(name.slice(0, 200)), { status: 201 });
};
