import type { LayoutServerLoad } from './$types';
import { groupTitle, listMembers, requireMembership } from '$lib/server/services/groups';

export const load: LayoutServerLoad = ({ locals, params }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	const { group } = actor;
	return {
		group: {
			id: group.id,
			kind: group.kind,
			name: group.name,
			title: groupTitle(group, actor.userId),
			emoji: group.emoji,
			type: group.type,
			budgetCents: group.budgetCents,
			archived: !!group.archivedAt
		},
		members: listMembers(group.id, actor.userId),
		myMemberId: actor.member.id,
		isAdmin: actor.member.role === 'admin'
	};
};
