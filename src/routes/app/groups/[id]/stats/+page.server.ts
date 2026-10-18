import type { PageServerLoad } from './$types';
import { requireMembership } from '$lib/server/services/groups';
import { groupStats } from '$lib/server/services/stats';

export const load: PageServerLoad = ({ locals, params }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	return { stats: groupStats(actor.group.id) };
};
