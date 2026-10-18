import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteSessionCookie, invalidateSession } from '$lib/server/auth/session';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: ({ locals, cookies }) => {
		if (locals.session) invalidateSession(locals.session.id);
		deleteSessionCookie(cookies);
		// `?logout` tells the client to clear the personal-data caches of the service worker.
		redirect(303, '/?logout=1');
	}
};
