import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { passwordKey } from './config';
import { db } from './db';

const NONCE_TTL = 2 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'session';

const nonces = new Map<string, number>();

export function createNonce(): string {
	const now = Date.now();
	for (const [n, exp] of nonces) if (exp < now) nonces.delete(n);
	const nonce = randomBytes(32).toString('hex');
	nonces.set(nonce, now + NONCE_TTL);
	return nonce;
}

/** Verifies proof = HMAC-SHA256(SHA-256(password), nonce). Nonces are single use. */
export function verifyProof(nonce: string, proof: string): boolean {
	const exp = nonces.get(nonce);
	nonces.delete(nonce);
	if (!exp || exp < Date.now()) return false;
	const expected = createHmac('sha256', passwordKey).update(nonce).digest();
	const given = Buffer.from(proof, 'hex');
	return given.length === expected.length && timingSafeEqual(given, expected);
}

export function createSession(): { token: string; expires: Date } {
	const token = randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_TTL;
	db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
	return { token, expires: new Date(expiresAt) };
}

export function validSession(token: string | undefined): boolean {
	if (!token) return false;
	const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token) as
		{ expires_at: number } | undefined;
	return !!row && row.expires_at > Date.now();
}

export function deleteSession(token: string | undefined) {
	if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}
