import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, locals.user!.id)).run();
		const next = (await request.formData()).get('next');
		redirect(303, next === 'group' ? '/app/groups/new?first=1' : '/app');
	}
};
