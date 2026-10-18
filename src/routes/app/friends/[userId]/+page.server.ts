import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { friendBalances, userGroupSummaries } from '$lib/server/services/balances';
import { ensureDirectGroup, listMembers } from '$lib/server/services/groups';

export const load: PageServerLoad = ({ locals, params }) => {
	const userId = locals.user!.id;
	const friend = friendBalances(userId, userGroupSummaries(userId), (gid) =>
		listMembers(gid, userId)
	).find((f) => f.userId === params.userId);
	// Only people you share a group with are visible (no user enumeration).
	if (!friend) error(404, 'Amico non trovato');
	return { friend };
};

export const actions: Actions = {
	direct: ({ locals, params }) => {
		const userId = locals.user!.id;
		const known = friendBalances(userId, userGroupSummaries(userId), (gid) =>
			listMembers(gid, userId)
		).some((f) => f.userId === params.userId);
		if (!known) error(404, 'Amico non trovato');
		redirect(303, `/app/groups/${ensureDirectGroup(userId, params.userId)}`);
	}
};
