import { error } from '@sveltejs/kit';
import { getSong } from '#lib/server/db.ts';

export const load = ({ params }) => {
	const song = getSong(params.id);
	if (!song) error(404, 'Song not found');
	return { song };
};
