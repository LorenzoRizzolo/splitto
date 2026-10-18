import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth/password';
import { checkResetToken, consumeResetToken } from '$lib/server/auth/password-reset';
import { invalidateUserSessions } from '$lib/server/auth/session';
import { invalid, parseForm, zPassword } from '$lib/server/forms';

export const load: PageServerLoad = ({ params }) => ({
	valid: checkResetToken(params.token) !== null
});

export const actions: Actions = {
	default: async ({ request, params }) => {
		const userId = checkResetToken(params.token);
		if (!userId) return invalid({ form: 'Il link non è più valido. Richiedine uno nuovo.' });
		const form = parseForm(
			z
				.object({ password: zPassword, confirm: z.string() })
				.refine((v) => v.password === v.confirm, {
					message: 'Le password non coincidono',
					path: ['confirm']
				}),
			await request.formData()
		);
		if (!form.ok) return invalid(form.errors);

		db.update(users)
			.set({ passwordHash: await hashPassword(form.data.password) })
			.where(eq(users.id, userId))
			.run();
		consumeResetToken(params.token);
		// A password reset logs out every device.
		invalidateUserSessions(userId);
		redirect(303, '/login?reset=1');
	}
};
