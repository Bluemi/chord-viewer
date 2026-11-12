import { json } from '@sveltejs/kit';
import { createNonce } from '#lib/server/auth.ts';

export const GET = () => json({ nonce: createNonce() });
