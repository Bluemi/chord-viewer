import { loadJson } from '#lib/api.ts';
import type { SongSummary } from '#lib/song.ts';

export const load = async ({ fetch }) => ({
	songs: await loadJson<SongSummary[]>(fetch, '/api/songs')
});
