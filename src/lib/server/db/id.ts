import { randomBytes } from 'node:crypto';

/** URL-safe random id (120 bits), not guessable or sequential. */
export function newId(): string {
	return randomBytes(15).toString('base64url');
}

/** URL-safe random secret token (256 bits) for sessions, invites, resets. */
export function newToken(): string {
	return randomBytes(32).toString('base64url');
}
