import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGroup, listMembers } from '$lib/server/services/groups';
import { friendBalances, userGroupSummaries } from '$lib/server/services/balances';
import { groupSchema, toGroupInput } from '$lib/server/group-form';
import { invalid, parseForm } from '$lib/server/forms';

/** Registered users the viewer shares at least one group with. */
function registeredFriends(userId: string) {
	return friendBalances(userId, userGroupSummaries(userId), (gid) => listMembers(gid, userId))
		.filter((f): f is typeof f & { userId: string } => !!f.userId)
		.sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export const load: PageServerLoad = ({ url, locals }) => ({
	first: url.searchParams.has('first'),
	friends: registeredFriends(locals.user!.id).map((f) => ({
		userId: f.userId,
		name: f.name,
		avatarUrl: f.avatarUrl,
		avatarColor: f.avatarColor
	}))
});

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
		const picked = new Set(data.getAll('friend'));
		const friends = picked.size
			? registeredFriends(locals.user!.id)
					.filter((f) => picked.has(f.userId))
					.map((f) => ({ userId: f.userId, name: f.name }))
			: [];
		const id = createGroup(locals.user!.id, toGroupInput(form.data), guests, friends);
		redirect(303, `/app/groups/${id}?created=1`);
	}
};
