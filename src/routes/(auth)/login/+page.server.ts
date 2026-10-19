import { redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { verifyPassword, hashPassword } from '$lib/server/auth/password';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import { limiters, retryMessage } from '$lib/server/auth/rate-limit';
import { invalid, parseForm, zEmail } from '$lib/server/forms';
import { safeRedirect } from '$lib/server/redirect';
import {
	enabledProviders,
	OAUTH_ERROR_MESSAGES,
	type OAuthErrorCode
} from '$lib/server/auth/oauth';

const schema = z.object({
	email: zEmail,
	password: z.string().min(1, 'Inserisci la password').max(128),
	redirectTo: z.string().optional()
});

// Verifying against a dummy hash for unknown emails keeps response times uniform.
let dummyHash: Promise<string> | undefined;

export const load: PageServerLoad = ({ url }) => {
	const oauthError = url.searchParams.get('oauthError');
	return {
		redirectTo: url.searchParams.get('redirectTo') ?? '',
		reset: url.searchParams.has('reset'),
		providers: enabledProviders(),
		oauthError:
			oauthError && oauthError in OAUTH_ERROR_MESSAGES
				? OAUTH_ERROR_MESSAGES[oauthError as OAuthErrorCode]
				: null
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const form = parseForm(schema, await request.formData());
		if (!form.ok) return invalid(form.errors, form.values);
		const { email, password, redirectTo } = form.data;

		const ip = getClientAddress();
		for (const check of [limiters.loginIp.hit(ip), limiters.loginAccount.hit(`${ip}|${email}`)]) {
			if (!check.allowed) return invalid({ form: retryMessage(check.retryAfterSec) }, { email });
		}

		const user = db
			.select({ id: users.id, passwordHash: users.passwordHash })
			.from(users)
			.where(and(eq(users.email, email), isNull(users.deletedAt)))
			.get();
		dummyHash ??= hashPassword('dummy-password-for-timing');
		const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
		if (!user || !ok) {
			return invalid({ form: 'Email o password non corretti' }, { email, redirectTo });
		}

		limiters.loginAccount.reset(`${ip}|${email}`);
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, safeRedirect(redirectTo));
	}
};
