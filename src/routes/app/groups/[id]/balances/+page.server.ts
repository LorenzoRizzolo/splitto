import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireMembership } from '$lib/server/services/groups';
import { groupBalances } from '$lib/server/services/balances';
import {
	canRemind,
	createSettlement,
	deleteSettlement,
	getSettlement,
	listSettlements,
	sendReminder
} from '$lib/server/services/settlements';
import { SETTLEMENT_METHODS } from '$lib/server/db/schema';
import { invalid, parseForm, zDate, zId } from '$lib/server/forms';
import { parseAmount } from '$lib/domain/money';
import { todayISO } from '$lib/domain/dates';

export const load: PageServerLoad = ({ locals, params, url }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	const b = groupBalances(actor.group);
	const remindable = new Set(
		b.debts
			.filter((d) => d.to === actor.member.id && canRemind(actor.userId, d.from))
			.map((d) => d.from)
	);
	const amount = parseAmount(url.searchParams.get('amount') ?? '');
	return {
		net: [...b.net.entries()].map(([memberId, cents]) => ({ memberId, cents })),
		debts: b.debts.map((d) => ({ ...d, canRemind: remindable.has(d.from) })),
		settled: b.settled,
		recent: listSettlements(actor.group.id, 10).map((s) => ({
			id: s.id,
			from: s.fromMemberId,
			to: s.toMemberId,
			cents: s.amountCents,
			method: s.method,
			date: s.date,
			note: s.note,
			canDelete: s.createdBy === actor.userId || actor.member.role === 'admin'
		})),
		prefill: {
			from: url.searchParams.get('from') ?? actor.member.id,
			to: url.searchParams.get('to') ?? '',
			amount: amount ?? null
		},
		today: todayISO()
	};
};

const settleSchema = z.object({
	from: zId,
	to: zId,
	amount: z.string().transform((v, ctx) => {
		const c = parseAmount(v);
		if (!c) {
			ctx.addIssue({ code: 'custom', message: 'Importo non valido (es. 12,50)' });
			return z.NEVER;
		}
		return c;
	}),
	method: z.enum(SETTLEMENT_METHODS).default('cash'),
	date: zDate,
	note: z.string().trim().max(200).optional()
});

export const actions: Actions = {
	settle: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const form = parseForm(settleSchema, await request.formData());
		if (!form.ok) return invalid(form.errors, form.values, 'settle');
		if (form.data.from === form.data.to) {
			return invalid({ to: 'Chi paga e chi riceve devono essere diversi' }, form.values, 'settle');
		}
		const { groupSettled } = createSettlement(actor, {
			fromMemberId: form.data.from,
			toMemberId: form.data.to,
			amountCents: form.data.amount,
			method: form.data.method,
			date: form.data.date,
			note: form.data.note || null
		});
		return { settledOk: true, groupSettled, amount: form.data.amount };
	},
	remind: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const member = (await request.formData()).get('member');
		if (typeof member !== 'string') return fail(400, { remindError: 'Richiesta non valida' });
		const r = sendReminder(actor, member);
		if (!r.ok) return fail(400, { remindError: r.message });
		return { reminded: member };
	},
	deleteSettlement: async ({ locals, params, request }) => {
		const actor = requireMembership(locals.user!.id, params.id);
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string') return fail(400);
		deleteSettlement(actor, getSettlement(actor.group.id, id));
		return { settlementDeleted: true };
	}
};
