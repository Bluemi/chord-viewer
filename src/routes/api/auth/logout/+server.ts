import { json } from '@sveltejs/kit';
import { deleteSession, SESSION_COOKIE } from '#lib/server/auth.ts';

export const POST = ({ cookies }) => {
	deleteSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
