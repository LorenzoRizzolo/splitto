import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isOAuthProvider, startOAuth, OAuthError } from '$lib/server/auth/oauth';
import { safeRedirect } from '$lib/server/redirect';

/** Starts "Accedi con Google": redirects to the provider's consent screen. */
export const GET: RequestHandler = ({ params, url, cookies }) => {
	if (!isOAuthProvider(params.provider)) error(404, 'Pagina non trovata');
	const redirectTo = url.searchParams.get('redirectTo');
	let target: URL;
	try {
		target = startOAuth(params.provider, cookies, redirectTo ? safeRedirect(redirectTo) : '');
	} catch (err) {
		if (err instanceof OAuthError) redirect(303, `/login?oauthError=${err.code}`);
		throw err;
	}
	redirect(303, target.toString());
};
