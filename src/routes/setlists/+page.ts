import { loadJson } from '#lib/api.ts';
import type { Setlist } from '#lib/song.ts';

export const load = async ({ fetch }) => ({
	setlists: await loadJson<Setlist[]>(fetch, '/api/setlists')
});
