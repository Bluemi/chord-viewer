import { error, json } from '@sveltejs/kit';
import { createSession, SESSION_COOKIE, verifyProof } from '#lib/server/auth.ts';

export const POST = async ({ request, cookies, url }) => {
	const { nonce, proof } = await request.json();
	if (typeof nonce !== 'string' || typeof proof !== 'string' || !verifyProof(nonce, proof)) {
		await new Promise((r) => setTimeout(r, 500));
		error(401, 'Wrong password');
	}
	const { token, expires } = createSession();
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: url.protocol === 'https:',
		expires
	});
	return json({ ok: true });
};
