import { error, json } from '@sveltejs/kit';
import { deleteSetlist, getSetlist, updateSetlist } from '#lib/server/db.ts';

export const GET = ({ params }) => {
	const setlist = getSetlist(params.id);
	if (!setlist) error(404, 'Setlist not found');
	return json(setlist);
};

export const PUT = async ({ params, request }) => {
	const body = await request.json();
	const patch: { name?: string; songIds?: string[] } = {};
	if (typeof body.name === 'string') patch.name = body.name.slice(0, 200);
	if (body.songIds !== undefined) {
		if (!Array.isArray(body.songIds) || !body.songIds.every((s: unknown) => typeof s === 'string'))
			error(400, 'Invalid songIds');
		patch.songIds = body.songIds.slice(0, 1000);
	}
	const setlist = updateSetlist(params.id, patch);
	if (!setlist) error(404, 'Setlist not found');
	return json(setlist);
};

export const DELETE = ({ params }) => {
	if (!getSetlist(params.id)) error(404, 'Setlist not found');
	deleteSetlist(params.id);
	return json({ ok: true });
};
