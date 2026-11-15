import { self as sw } from '$app/service-worker';
import { immutable, assets as staticFiles } from '$app/manifest';
import { version } from '$app/env';
import { AUDIO_CACHE, DATA_CACHE } from '#lib/offline.ts';

const STATIC_CACHE = `cv-static-${version}`;
/** Pages are client-rendered, so every route uses the same HTML shell. */
const SHELL = '/__shell';
const assets = new Set([...immutable, ...staticFiles].map((a) => a.path as string));

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			await cache.addAll([...assets]);
			const shell = await fetch('/login', { cache: 'no-store' });
			if (shell.ok) await cache.put(SHELL, shell);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('cv-static-') && key !== STATIC_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/auth/')) return;

	if (/^\/api\/songs\/[^/]+\/audio$/.test(url.pathname)) {
		event.respondWith(audio(req, url));
	} else if (url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(req));
	} else if (assets.has(url.pathname)) {
		event.respondWith(cacheFirst(req));
	} else if (req.mode === 'navigate') {
		event.respondWith(navigate(req));
	}
});

async function cacheFirst(req: Request) {
	return (await caches.match(req)) ?? fetch(req);
}

async function navigate(req: Request) {
	try {
		return await fetch(req);
	} catch {
		return (await caches.match(SHELL)) ?? offlineResponse();
	}
}

/** API data: always try the network (and refresh the cache), fall back to the cache when offline. */
async function networkFirst(req: Request) {
	try {
		const res = await fetch(req);
		if (res.ok) {
			const cache = await caches.open(DATA_CACHE);
			await cache.put(req, res.clone());
		}
		return res;
	} catch {
		return (
			(await caches.match(req, { cacheName: DATA_CACHE, ignoreSearch: true })) ?? offlineResponse()
		);
	}
}

/** Audio: stream from the network; offline, serve the downloaded file, including Range requests for seeking. */
async function audio(req: Request, url: URL) {
	try {
		return await fetch(req);
	} catch {
		const cached = await caches.match(url.pathname, { cacheName: AUDIO_CACHE });
		if (!cached) return offlineResponse();
		const blob = await cached.blob();
		const type = cached.headers.get('content-type') ?? 'application/octet-stream';
		const m = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
		if (!m || (!m[1] && !m[2])) {
			return new Response(blob, {
				headers: {
					'content-type': type,
					'content-length': String(blob.size),
					'accept-ranges': 'bytes'
				}
			});
		}
		const size = blob.size;
		const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
		const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
		if (start >= size || start > end) {
			return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
		}
		return new Response(blob.slice(start, end + 1), {
			status: 206,
			headers: {
				'content-type': type,
				'content-length': String(end - start + 1),
				'content-range': `bytes ${start}-${end}/${size}`,
				'accept-ranges': 'bytes'
			}
		});
	}
}

function offlineResponse() {
	return Response.json({ message: 'Offline' }, { status: 503 });
}
