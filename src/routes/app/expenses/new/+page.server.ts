import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { groupTitle, listMembers, requireMembership } from '$lib/server/services/groups';
import { lastUsedGroupId } from '$lib/server/services/expenses';
import { userGroupSummaries } from '$lib/server/services/balances';
import { handleExpenseForm } from '$lib/server/expense-actions';
import { todayISO } from '$lib/domain/dates';

export const load: PageServerLoad = ({ locals, url }) => {
	const userId = locals.user!.id;
	const groups = userGroupSummaries(userId)
		.filter((s) => !s.group.archivedAt)
		.map((s) => ({
			id: s.group.id,
			title: groupTitle(s.group, userId),
			emoji: s.group.emoji,
			kind: s.group.kind
		}))
		.sort((a, b) =>
			a.kind === b.kind ? a.title.localeCompare(b.title, 'it') : a.kind === 'group' ? -1 : 1
		);
	if (groups.length === 0) redirect(303, '/app/groups/new?first=1');

	const requested = url.searchParams.get('group');
	const groupId = groups.some((g) => g.id === requested)
		? requested!
		: (lastUsedGroupId(userId) ?? groups[0]!.id);
	if (groupId !== requested) redirect(303, `/app/expenses/new?group=${groupId}`);
	const actor = requireMembership(userId, groupId);
	return {
		groups,
		groupId,
		members: listMembers(actor.group.id, userId).filter((m) => m.active),
		myMemberId: actor.member.id,
		today: todayISO()
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const actor = requireMembership(locals.user!.id, url.searchParams.get('group') ?? '');
		return handleExpenseForm(actor, await request.formData());
	}
};
