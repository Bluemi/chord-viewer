import { loadJson } from '#lib/api.ts';
import type { Setlist, SongSummary } from '#lib/song.ts';

export const load = async ({ fetch, params }) => {
	const [setlist, songs] = await Promise.all([
		loadJson<Setlist>(fetch, `/api/setlists/${params.id}`),
		loadJson<SongSummary[]>(fetch, '/api/songs')
	]);
	return { setlist, songs };
};
