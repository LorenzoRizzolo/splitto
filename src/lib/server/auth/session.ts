import { createHash } from 'node:crypto';
import { and, eq, lt, ne } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db } from '../db';
import { sessions, users, type User } from '../db/schema';
import { newToken } from '../db/id';
import { config } from '../config';

// Sessions are stored in the database; the cookie only holds a random token whose SHA-256
// is the session id, so a database leak does not leak usable session tokens.

export const SESSION_COOKIE = 'splitto_session';
const DAY = 86_400_000;

export type SessionUser = Pick<
	User,
	| 'id'
	| 'name'
	| 'email'
	| 'avatarPath'
	| 'avatarColor'
	| 'reduceMotion'
	| 'onboardedAt'
	| 'notifyPrefs'
>;
export type SessionInfo = { id: string; expiresAt: Date };

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function lifetimeMs() {
	return config.sessionDays * DAY;
}

export function createSession(userId: string): { token: string; expiresAt: Date } {
	const token = newToken();
	const expiresAt = new Date(Date.now() + lifetimeMs());
	db.insert(sessions)
		.values({ id: hashToken(token), userId, expiresAt })
		.run();
	return { token, expiresAt };
}

/**
 * Validates a session token. Implements sliding expiration: when less than half of the
 * lifetime is left, the expiry is pushed forward and `renewed` is true (the cookie must be
 * refreshed too).
 */
export function validateSessionToken(
	token: string
): { session: SessionInfo; user: SessionUser; renewed: boolean } | null {
	const id = hashToken(token);
	const row = db
		.select({
			expiresAt: sessions.expiresAt,
			user: {
				id: users.id,
				name: users.name,
				email: users.email,
				avatarPath: users.avatarPath,
				avatarColor: users.avatarColor,
				reduceMotion: users.reduceMotion,
				onboardedAt: users.onboardedAt,
				notifyPrefs: users.notifyPrefs,
				deletedAt: users.deletedAt
			}
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	const now = Date.now();
	if (row.expiresAt.getTime() <= now || row.user.deletedAt) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	let expiresAt = row.expiresAt;
	let renewed = false;
	if (expiresAt.getTime() - now < lifetimeMs() / 2) {
		expiresAt = new Date(now + lifetimeMs());
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
		renewed = true;
	}
	const { deletedAt: _deleted, ...user } = row.user;
	return { session: { id, expiresAt }, user, renewed };
}

export function invalidateSession(sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

/** Logs the user out everywhere, optionally keeping the current session. */
export function invalidateUserSessions(userId: string, exceptSessionId?: string) {
	db.delete(sessions)
		.where(
			exceptSessionId
				? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
				: eq(sessions.userId, userId)
		)
		.run();
}

export function deleteExpiredSessions() {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: config.cookieSecure,
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: config.cookieSecure
	});
}
