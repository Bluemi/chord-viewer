import { loadJson } from '#lib/api.ts';
import type { Setlist, Song, SongSummary } from '#lib/song.ts';

export interface SetlistContext {
	setlist: Setlist;
	/** Position of this song in the setlist (a song can appear more than once). */
	pos: number;
	prev: SongSummary | null;
	next: SongSummary | null;
}

export const load = async ({ fetch, params, url }) => {
	const song = await loadJson<Song>(fetch, `/api/songs/${params.id}`);
	let setlist: SetlistContext | null = null;
	const setlistId = url.searchParams.get('setlist');
	if (setlistId) {
		try {
			const [sl, songs] = await Promise.all([
				loadJson<Setlist>(fetch, `/api/setlists/${setlistId}`),
				loadJson<SongSummary[]>(fetch, '/api/songs')
			]);
			const byId = new Map(songs.map((s) => [s.id, s]));
			// Ignore songs that were deleted after being added to the setlist.
			const entries = sl.songIds.filter((id) => byId.has(id));
			let pos = Number(url.searchParams.get('pos'));
			if (!Number.isInteger(pos) || entries[pos] !== song.id) pos = entries.indexOf(song.id);
			if (pos >= 0) {
				setlist = {
					setlist: { ...sl, songIds: entries },
					pos,
					prev: byId.get(entries[pos - 1]) ?? null,
					next: byId.get(entries[pos + 1]) ?? null
				};
			}
		} catch {
			// Setlist unavailable (e.g. offline and not cached): show the song without it.
		}
	}
	return { song, setlist };
};
