import { error, redirect } from '@sveltejs/kit';
import { cacheSong } from './offline.ts';
import type { Song } from './song.ts';

/** GET JSON from the API inside a load function; redirects to login on 401. */
export async function loadJson<T>(fetch: typeof globalThis.fetch, url: string): Promise<T> {
	const res = await fetch(url);
	if (res.status === 401) redirect(307, '/login');
	if (res.status === 503) error(503, 'Offline: this song has not been downloaded');
	if (!res.ok) error(res.status, res.status === 404 ? 'Song not found' : 'Could not load data');
	return res.json();
}

/** Set a song's status (null clears it) and keep the offline copy in sync. */
export async function setSongStatus(id: string, status: string | null): Promise<Song> {
	const res = await fetch(`/api/songs/${id}`, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ status })
	});
	if (!res.ok) throw new Error(`Could not save status (${res.status})`);
	const song: Song = await res.json();
	cacheSong(song).catch(console.error);
	return song;
}
