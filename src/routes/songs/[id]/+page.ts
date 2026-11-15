import { loadJson } from '#lib/api.ts';
import type { Song } from '#lib/song.ts';

export const load = async ({ fetch, params }) => ({
	song: await loadJson<Song>(fetch, `/api/songs/${params.id}`)
});
