import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { oauthAccounts, users } from '../db/schema';
import { newId } from '../db/id';
import { OAuthError, signIn, type Profile } from './oauth';

const profile = (over: Partial<Profile> = {}): Profile => ({
	provider: 'google',
	providerUserId: newId(),
	email: `${newId()}@gmail.com`.toLowerCase(),
	emailVerified: true,
	name: 'Anna Rossi',
	...over
});

describe('oauth sign-in', () => {
	it('creates a passwordless account and reuses it on the next login', () => {
		const p = profile();
		const first = signIn(p);
		expect(first.created).toBe(true);
		const user = db.select().from(users).where(eq(users.id, first.userId)).get()!;
		expect(user).toMatchObject({ name: 'Anna Rossi', email: p.email, passwordHash: '' });

		// The email may change on the provider side: the identity (sub) is what counts.
		expect(signIn({ ...p, email: 'altra@gmail.com' })).toEqual({
			userId: first.userId,
			created: false
		});
	});

	it('links to an existing account with the same verified email', () => {
		const id = newId();
		const email = `${id}@test.it`.toLowerCase();
		db.insert(users)
			.values({ id, name: 'Marco', email, passwordHash: 'x', avatarColor: '#000' })
			.run();

		const result = signIn(profile({ email: email.toUpperCase() }));
		expect(result).toEqual({ userId: id, created: false });
		expect(db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, id)).all()).toHaveLength(
			1
		);
	});

	it('refuses unverified or missing emails for unknown identities', () => {
		const id = newId();
		const email = `${id}@test.it`.toLowerCase();
		db.insert(users)
			.values({ id, name: 'Luca', email, passwordHash: 'x', avatarColor: '#000' })
			.run();

		expect(() => signIn(profile({ email, emailVerified: false }))).toThrow(OAuthError);
		expect(() => signIn(profile({ email: null }))).toThrow(OAuthError);
		expect(db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, id)).all()).toHaveLength(
			0
		);
	});

	it('falls back to the email name when the provider sends none', () => {
		const p = profile({ email: 'giulia.bianchi@gmail.com', name: null });
		const { userId } = signIn(p);
		expect(db.select().from(users).where(eq(users.id, userId)).get()?.name).toBe('giulia.bianchi');
	});
});
