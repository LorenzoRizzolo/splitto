import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { newId } from '$lib/server/db/id';
import { hashPassword } from '$lib/server/auth/password';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import { limiters, retryMessage } from '$lib/server/auth/rate-limit';
import { invalid, parseForm, zEmail, zName, zPassword } from '$lib/server/forms';
import { safeRedirect } from '$lib/server/redirect';
import { pickAvatarColor } from '$lib/domain/avatar';
import { enabledProviders } from '$lib/server/auth/oauth';

const schema = z.object({
	name: zName,
	email: zEmail,
	password: zPassword,
	redirectTo: z.string().optional()
});

export const load: PageServerLoad = ({ url }) => ({
	redirectTo: url.searchParams.get('redirectTo') ?? '',
	providers: enabledProviders()
});

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const form = parseForm(schema, await request.formData());
		if (!form.ok) return invalid(form.errors, form.values);
		const { name, email, password, redirectTo } = form.data;

		const limit = limiters.register.hit(getClientAddress());
		if (!limit.allowed)
			return invalid({ form: retryMessage(limit.retryAfterSec) }, { name, email });

		const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
		if (existing) {
			return invalid(
				{ email: 'Esiste già un account con questa email. Prova ad accedere.' },
				{ name, email, redirectTo }
			);
		}

		const id = newId();
		db.insert(users)
			.values({
				id,
				name,
				email,
				passwordHash: await hashPassword(password),
				avatarColor: pickAvatarColor(email)
			})
			.run();

		const { token, expiresAt } = createSession(id);
		setSessionCookie(cookies, token, expiresAt);
		// New users see the onboarding first, unless they came from an invite link.
		redirect(303, redirectTo ? safeRedirect(redirectTo) : '/app/welcome');
	}
};
