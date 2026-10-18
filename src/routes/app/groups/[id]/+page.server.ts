import { z } from 'zod';
import type { PageServerLoad } from './$types';
import { requireMembership } from '$lib/server/services/groups';
import { groupSpent, listExpenses } from '$lib/server/services/expenses';
import { groupBalances } from '$lib/server/services/balances';
import { listSettlements } from '$lib/server/services/settlements';
import { CATEGORIES } from '$lib/domain/categories';

const filterSchema = z.object({
	q: z.string().trim().max(100).optional().catch(undefined),
	category: z.enum(CATEGORIES).optional().catch(undefined),
	member: z.string().max(64).optional().catch(undefined),
	from: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.catch(undefined),
	to: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.catch(undefined)
});

export const load: PageServerLoad = ({ locals, params, url }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	const f = filterSchema.parse(Object.fromEntries(url.searchParams));
	const filters = {
		q: f.q || undefined,
		category: f.category,
		memberId: f.member || undefined,
		from: f.from,
		to: f.to
	};
	const filtering = Object.values(filters).some(Boolean);
	const balances = groupBalances(actor.group);
	return {
		filters: {
			q: f.q ?? '',
			category: f.category ?? '',
			member: f.member ?? '',
			from: f.from ?? '',
			to: f.to ?? ''
		},
		filtering,
		expenses: listExpenses(actor.group.id, actor.member.id, filters),
		settlements: filtering
			? []
			: listSettlements(actor.group.id).map((s) => ({
					id: s.id,
					date: s.date,
					from: s.fromMemberId,
					to: s.toMemberId,
					cents: s.amountCents,
					method: s.method,
					createdAt: s.createdAt
				})),
		myNet: balances.net.get(actor.member.id) ?? 0,
		settled: balances.settled,
		debts: balances.debts,
		spent: groupSpent(actor.group.id),
		created: url.searchParams.has('created')
	};
};
