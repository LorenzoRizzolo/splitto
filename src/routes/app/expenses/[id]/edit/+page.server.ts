import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { canEditExpense, getExpenseDetail, getExpenseForUser } from '$lib/server/services/expenses';
import { listMembers } from '$lib/server/services/groups';
import { handleExpenseForm } from '$lib/server/expense-actions';
import type { SplitInput } from '$lib/domain/split';

export const load: PageServerLoad = ({ locals, params }) => {
	const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
	if (!canEditExpense(actor, expense) || actor.group.archivedAt || expense.deletedAt) {
		error(403, 'Non puoi modificare questa spesa');
	}
	const detail = getExpenseDetail(expense.id);
	return {
		members: listMembers(expense.groupId, actor.userId),
		expense: {
			id: expense.id,
			description: expense.description,
			amountCents: expense.amountCents,
			date: expense.date,
			category: expense.category,
			notes: expense.notes ?? '',
			payers: detail.payers.map((p) => ({ memberId: p.memberId, cents: p.amountCents })),
			split: expense.splitInput as SplitInput,
			hasReceipt: !!expense.receiptPath
		}
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
		return handleExpenseForm(actor, await request.formData(), expense);
	}
};
