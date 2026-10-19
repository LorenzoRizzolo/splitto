import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { completeOAuth, isOAuthProvider, OAuthError } from '$lib/server/auth/oauth';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import { limiters, retryMessage } from '$lib/server/auth/rate-limit';
import { safeRedirect } from '$lib/server/redirect';

type Params = {
	code: string | null;
	state: string | null;
	error: string | null;
};

async function handle(event: RequestEvent, params: Params): Promise<never> {
	const { provider } = event.params;
	if (!isOAuthProvider(provider)) error(404, 'Pagina non trovata');

	const limit = limiters.loginIp.hit(event.getClientAddress());
	if (!limit.allowed) error(429, retryMessage(limit.retryAfterSec));

	let result: Awaited<ReturnType<typeof completeOAuth>>;
	try {
		result = await completeOAuth(provider, event.cookies, params);
	} catch (err) {
		if (err instanceof OAuthError) redirect(303, `/login?oauthError=${err.code}`);
		throw err;
	}

	const { token, expiresAt } = createSession(result.userId);
	setSessionCookie(event.cookies, token, expiresAt);
	// Same rule as registration: new users see the onboarding unless they came from an invite.
	const fallback = result.created ? '/app/welcome' : '/app';
	redirect(303, result.redirectTo ? safeRedirect(result.redirectTo) : fallback);
}

export const GET: RequestHandler = (event) => {
	const q = event.url.searchParams;
	return handle(event, { code: q.get('code'), state: q.get('state'), error: q.get('error') });
};
