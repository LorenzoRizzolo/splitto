import type { PageServerLoad } from './$types';
import { userGroupSummaries } from '$lib/server/services/balances';
import { listMembers } from '$lib/server/services/groups';

export const load: PageServerLoad = ({ locals }) => {
	const groups = userGroupSummaries(locals.user!.id)
		.filter((s) => s.group.kind === 'group')
		.map((s) => ({
			id: s.group.id,
			name: s.group.name,
			emoji: s.group.emoji,
			net: s.myNet,
			archived: !!s.group.archivedAt,
			members: listMembers(s.group.id)
				.filter((m) => m.active)
				.map((m) => m.name)
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'it'));
	return { active: groups.filter((g) => !g.archived), archived: groups.filter((g) => g.archived) };
};
