import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGroup } from '$lib/server/services/groups';
import { groupSchema, toGroupInput } from '$lib/server/group-form';
import { invalid, parseForm } from '$lib/server/forms';

export const load: PageServerLoad = ({ url }) => ({ first: url.searchParams.has('first') });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const form = parseForm(groupSchema, data);
		if (!form.ok) return invalid(form.errors, form.values);
		const guests = data
			.getAll('guest')
			.filter((g): g is string => typeof g === 'string')
			.map((g) => g.trim().slice(0, 60))
			.filter(Boolean)
			.slice(0, 50);
		const id = createGroup(locals.user!.id, toGroupInput(form.data), guests);
		redirect(303, `/app/groups/${id}?created=1`);
	}
};
