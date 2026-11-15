import { error, redirect } from '@sveltejs/kit';

/** GET JSON from the API inside a load function; redirects to login on 401. */
export async function loadJson<T>(fetch: typeof globalThis.fetch, url: string): Promise<T> {
	const res = await fetch(url);
	if (res.status === 401) redirect(307, '/login');
	if (res.status === 503) error(503, 'Offline: this song has not been downloaded');
	if (!res.ok) error(res.status, res.status === 404 ? 'Song not found' : 'Could not load data');
	return res.json();
}
