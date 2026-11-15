import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE, validSession } from '#lib/server/auth.ts';

const PUBLIC = ['/login', '/api/auth/', '/api/app'];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p));
	if (!isPublic && !validSession(event.cookies.get(SESSION_COOKIE))) {
		if (path.startsWith('/api/')) error(401, 'Not logged in');
		redirect(303, '/login');
	}
	return resolve(event);
};
