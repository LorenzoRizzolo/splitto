import { and, eq, isNull } from 'drizzle-orm';
import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import type { Cookies } from '@sveltejs/kit';
import { db } from '../db';
import { oauthAccounts, users, OAUTH_PROVIDERS, type OAuthProvider } from '../db/schema';
import { newId } from '../db/id';
import { config } from '../config';
import { pickAvatarColor } from '../../domain/avatar';

// "Accedi con Google" via the authorization code flow (arctic). The ID token comes
// straight from the provider's token endpoint over TLS, so its claims are trusted without
// re-verifying the signature (OpenID Connect Core §3.1.3.7).

export function isOAuthProvider(value: string): value is OAuthProvider {
	return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function redirectURI(provider: OAuthProvider) {
	return `${config.origin}/login/${provider}/callback`;
}

function google(): Google | null {
	const { clientId, clientSecret } = config.google;
	if (!clientId || !clientSecret) return null;
	return new Google(clientId, clientSecret, redirectURI('google'));
}

export function enabledProviders(): Record<OAuthProvider, boolean> {
	const g = config.google;
	return { google: !!(g.clientId && g.clientSecret) };
}

// --- Flow state cookie -------------------------------------------------------------------------

const STATE_COOKIE = 'splitto_oauth';
const STATE_MAX_AGE = 10 * 60;

type FlowState = { state: string; verifier: string; redirectTo: string };

// Google comes back with a top-level GET, so SameSite=Lax is enough.
function stateCookieOptions() {
	return { path: '/login', httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure };
}

/** Builds the provider's authorization URL and remembers the flow state in a cookie. */
export function startOAuth(provider: OAuthProvider, cookies: Cookies, redirectTo: string): URL {
	const state = generateState();
	const client = provider === 'google' ? google() : null;
	if (!client) throw new OAuthError('disabled');
	const verifier = generateCodeVerifier();
	const url = client.createAuthorizationURL(state, verifier, ['openid', 'profile', 'email']);
	url.searchParams.set('prompt', 'select_account');
	const flow: FlowState = { state, verifier, redirectTo };
	cookies.set(STATE_COOKIE, JSON.stringify(flow), {
		...stateCookieOptions(),
		maxAge: STATE_MAX_AGE
	});
	return url;
}

/** Reads and clears the flow cookie, checking it matches the `state` sent back. */
function takeFlowState(cookies: Cookies, state: string | null): FlowState {
	const raw = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, stateCookieOptions());
	let flow: FlowState | null;
	try {
		flow = raw ? (JSON.parse(raw) as FlowState) : null;
	} catch {
		flow = null;
	}
	if (!flow || !state || flow.state !== state) throw new OAuthError('failed');
	return flow;
}

// --- Callback ----------------------------------------------------------------------------------

export type OAuthErrorCode = 'disabled' | 'cancelled' | 'failed' | 'no_email';

export class OAuthError extends Error {
	constructor(readonly code: OAuthErrorCode) {
		super(code);
	}
}

export type Profile = {
	provider: OAuthProvider;
	providerUserId: string;
	email: string | null;
	emailVerified: boolean;
	name: string | null;
};

type CallbackParams = {
	code: string | null;
	state: string | null;
	error: string | null;
};

/** Exchanges the authorization code and returns the signed-in user. */
export async function completeOAuth(
	provider: OAuthProvider,
	cookies: Cookies,
	params: CallbackParams
): Promise<{ userId: string; created: boolean; redirectTo: string }> {
	if (params.error) {
		cookies.delete(STATE_COOKIE, stateCookieOptions());
		throw new OAuthError(
			params.error.includes('cancel') || params.error === 'access_denied' ? 'cancelled' : 'failed'
		);
	}
	const flow = takeFlowState(cookies, params.state);
	if (!params.code) throw new OAuthError('failed');

	let profile: Profile;
	try {
		profile = await googleProfile(params.code, flow.verifier);
	} catch (err) {
		if (err instanceof OAuthError) throw err;
		console.error(`[oauth] ${provider} code exchange failed`, err);
		throw new OAuthError('failed');
	}
	return { ...signIn(profile), redirectTo: flow.redirectTo };
}

async function googleProfile(code: string, verifier: string): Promise<Profile> {
	const client = google();
	if (!client) throw new OAuthError('disabled');
	const tokens = await client.validateAuthorizationCode(code, verifier);
	const claims = decodeIdToken(tokens.idToken()) as {
		sub: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
	};
	return {
		provider: 'google',
		providerUserId: claims.sub,
		email: claims.email ?? null,
		emailVerified: claims.email_verified === true,
		name: claims.name ?? null
	};
}

/**
 * Finds the user linked to this identity. Otherwise links it to the account with the same
 * (verified) email, or creates a new account without a password.
 */
export function signIn(profile: Profile): { userId: string; created: boolean } {
	return db.transaction((tx) => {
		const linked = tx
			.select({ userId: oauthAccounts.userId })
			.from(oauthAccounts)
			.innerJoin(users, eq(users.id, oauthAccounts.userId))
			.where(
				and(
					eq(oauthAccounts.provider, profile.provider),
					eq(oauthAccounts.providerUserId, profile.providerUserId),
					isNull(users.deletedAt)
				)
			)
			.get();
		if (linked) return { userId: linked.userId, created: false };

		// Only a verified address proves ownership of an existing account.
		const email = profile.email?.trim().toLowerCase();
		if (!email || !profile.emailVerified) throw new OAuthError('no_email');

		const link = (userId: string) =>
			tx
				.insert(oauthAccounts)
				.values({ provider: profile.provider, providerUserId: profile.providerUserId, userId })
				.run();

		const existing = tx
			.select({ id: users.id, deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.email, email))
			.get();
		if (existing) {
			if (existing.deletedAt) throw new OAuthError('failed');
			link(existing.id);
			return { userId: existing.id, created: false };
		}

		const id = newId();
		const name = (profile.name?.trim() || email.split('@')[0]!).slice(0, 60);
		tx.insert(users)
			.values({ id, name, email, passwordHash: '', avatarColor: pickAvatarColor(email) })
			.run();
		link(id);
		return { userId: id, created: true };
	});
}

export const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
	disabled: 'Questo metodo di accesso non è disponibile.',
	cancelled: 'Accesso annullato.',
	failed: 'Non è stato possibile completare l’accesso. Riprova.',
	no_email: 'Il tuo account non ha fornito un’email verificata: registrati con email e password.'
};
