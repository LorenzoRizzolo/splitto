import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireMembership } from '$lib/server/services/groups';
import {
	canEditExpense,
	getExpenseForUser,
	listExpenses,
	restoreExpense
} from '$lib/server/services/expenses';

export const load: PageServerLoad = ({ locals, params }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	return {
		trash: listExpenses(actor.group.id, actor.member.id, {}, { trash: true }).map((e) => ({
			...e,
			canRestore: canEditExpense(actor, e) && !actor.group.archivedAt
		}))
	};
};

export const actions: Actions = {
	restore: async ({ locals, params, request }) => {
		requireMembership(locals.user!.id, params.id);
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string') return fail(400);
		const { expense, actor } = getExpenseForUser(locals.user!.id, id);
		if (expense.groupId !== params.id) return fail(404);
		restoreExpense(actor, expense);
		return { restored: expense.description };
	}
};
