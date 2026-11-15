/**
 * Offline storage shared between the app and the service worker.
 *  - DATA_CACHE: API JSON responses (song list, songs, app meta), refreshed whenever online.
 *  - AUDIO_CACHE: full audio files, only stored when a song is downloaded explicitly.
 */
import type { Song, SongSummary } from './song.ts';

export const DATA_CACHE = 'cv-data';
export const AUDIO_CACHE = 'cv-audio';
export const AUDIO_ID_HEADER = 'x-audio-id';

export const songUrl = (id: string) => `/api/songs/${id}`;
export const audioUrl = (id: string) => `/api/songs/${id}/audio`;

export const offlineSupported = () => typeof caches !== 'undefined';

export type OfflineState = 'none' | 'downloaded' | 'stale';

/** Offline state of each song, compared against the (fresh) song list. */
export async function offlineStates(songs: SongSummary[]): Promise<Record<string, OfflineState>> {
	const out: Record<string, OfflineState> = {};
	if (!offlineSupported()) return out;
	const [data, audio] = await Promise.all([caches.open(DATA_CACHE), caches.open(AUDIO_CACHE)]);
	await Promise.all(
		songs.map(async (s) => {
			const [json, aud] = await Promise.all([
				data.match(songUrl(s.id)),
				audio.match(audioUrl(s.id))
			]);
			// A song with audio only counts as available offline once its audio was downloaded.
			if (!json || (s.audioId && !aud)) {
				out[s.id] = 'none';
				return;
			}
			const cached: Song = await json.json();
			const audioOk = !s.audioId || aud?.headers.get(AUDIO_ID_HEADER) === s.audioId;
			out[s.id] = cached.updatedAt >= s.updatedAt && audioOk ? 'downloaded' : 'stale';
		})
	);
	return out;
}

/** Store the latest song JSON in the offline cache (e.g. after saving). */
export async function cacheSong(song: Song) {
	if (!offlineSupported()) return;
	const data = await caches.open(DATA_CACHE);
	await data.put(songUrl(song.id), Response.json(song));
}

/** Download a song's data and audio for offline use. `onProgress` receives 0..1. */
export async function downloadSong(id: string, onProgress: (p: number) => void = () => {}) {
	const data = await caches.open(DATA_CACHE);
	const res = await fetch(songUrl(id), { cache: 'no-store' });
	if (!res.ok) throw new Error(`Could not load song (${res.status})`);
	const song: Song = await res.json();
	await data.put(songUrl(id), Response.json(song));
	// The overview and app metadata are needed to open the app offline.
	for (const url of ['/api/songs', '/api/app']) {
		const r = await fetch(url, { cache: 'no-store' });
		if (r.ok) await data.put(url, r);
	}

	const audio = await caches.open(AUDIO_CACHE);
	if (!song.audioId) {
		await audio.delete(audioUrl(id));
		onProgress(1);
		return;
	}
	const ar = await fetch(`${audioUrl(id)}?v=${encodeURIComponent(song.audioId)}`, {
		cache: 'no-store'
	});
	if (!ar.ok || !ar.body) throw new Error(`Could not load audio (${ar.status})`);
	const total = Number(ar.headers.get('content-length')) || 0;
	const reader = ar.body.getReader();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.length;
		if (total) onProgress(received / total);
	}
	const type = ar.headers.get('content-type') ?? 'application/octet-stream';
	await audio.put(
		audioUrl(id),
		new Response(new Blob(chunks, { type }), {
			headers: {
				'content-type': type,
				'content-length': String(received),
				[AUDIO_ID_HEADER]: song.audioId
			}
		})
	);
	onProgress(1);
}

export async function removeDownload(id: string) {
	if (!offlineSupported()) return;
	await Promise.all([
		caches.open(AUDIO_CACHE).then((c) => c.delete(audioUrl(id))),
		caches.open(DATA_CACHE).then((c) => c.delete(songUrl(id)))
	]);
}
