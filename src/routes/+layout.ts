// Pages are rendered in the browser so the app can run offline from the service worker cache.
export const ssr = false;

export const load = async ({ fetch }) => {
	try {
		const res = await fetch('/api/app');
		if (res.ok) return { appTitle: ((await res.json()).title as string) || 'Chord Viewer' };
	} catch {
		// offline and not cached yet
	}
	return { appTitle: 'Chord Viewer' };
};
