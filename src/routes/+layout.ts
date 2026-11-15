// Pages are rendered in the browser so the app can run offline from the service worker cache.
export const ssr = false;

interface AppMeta {
	title: string;
	statuses: string[];
}

export const load = async ({ fetch }) => {
	let meta: AppMeta = { title: 'Chord Viewer', statuses: [] };
	try {
		const res = await fetch('/api/app');
		if (res.ok) meta = { ...meta, ...(await res.json()) };
	} catch {
		// offline and not cached yet
	}
	return { appTitle: meta.title || 'Chord Viewer', statuses: meta.statuses };
};
