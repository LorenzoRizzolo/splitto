import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	addComment,
	canEditExpense,
	deleteComment,
	deleteExpense,
	getExpenseDetail,
	getExpenseForUser,
	restoreExpense
} from '$lib/server/services/expenses';
import { groupTitle, listMembers } from '$lib/server/services/groups';
import { parseForm } from '$lib/server/forms';

export const load: PageServerLoad = ({ locals, params }) => {
	const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
	const detail = getExpenseDetail(expense.id);
	const members = listMembers(expense.groupId, actor.userId);
	const creator = members.find((m) => m.userId === expense.createdBy);
	return {
		expense: {
			id: expense.id,
			description: expense.description,
			category: expense.category,
			date: expense.date,
			amountCents: expense.amountCents,
			splitMode: expense.splitMode,
			splitInput: expense.splitInput,
			notes: expense.notes,
			hasReceipt: !!expense.receiptPath,
			receiptIsPdf: expense.receiptPath?.endsWith('.pdf') ?? false,
			recurring: !!expense.recurringId,
			deleted: !!expense.deletedAt,
			createdAt: expense.createdAt,
			updatedAt: expense.updatedAt,
			creatorName: creator
				? creator.isMe
					? 'te'
					: creator.name
				: expense.recurringId
					? 'Splitto (ricorrente)'
					: 'un ex membro'
		},
		group: {
			id: actor.group.id,
			title: groupTitle(actor.group, actor.userId),
			emoji: actor.group.emoji,
			archived: !!actor.group.archivedAt
		},
		payers: detail.payers.map((p) => ({ memberId: p.memberId, cents: p.amountCents })),
		shares: detail.shares.map((s) => ({ memberId: s.memberId, cents: s.amountCents })),
		comments: detail.comments.map((c) => ({ ...c, mine: c.userId === actor.userId })),
		members,
		canEdit: canEditExpense(actor, expense) && !actor.group.archivedAt
	};
};

export const actions: Actions = {
	delete: ({ locals, params }) => {
		const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
		deleteExpense(actor, expense);
		return { deleted: true, groupId: expense.groupId };
	},
	restore: ({ locals, params }) => {
		const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
		restoreExpense(actor, expense);
		return { restored: true };
	},
	comment: async ({ locals, params, request }) => {
		const { expense, actor } = getExpenseForUser(locals.user!.id, params.id);
		const form = parseForm(
			z.object({
				body: z.string().trim().min(1, 'Scrivi un commento').max(1000, 'Massimo 1000 caratteri')
			}),
			await request.formData()
		);
		if (!form.ok) return fail(400, { commentError: form.errors.body });
		addComment(actor, expense, form.data.body);
		return { commented: true };
	},
	deleteComment: async ({ locals, params, request }) => {
		const { actor } = getExpenseForUser(locals.user!.id, params.id);
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string') error(400);
		deleteComment(actor, id);
		return {};
	},
	back: ({ locals, params }) => {
		const { expense } = getExpenseForUser(locals.user!.id, params.id);
		redirect(303, `/app/groups/${expense.groupId}`);
	}
};
