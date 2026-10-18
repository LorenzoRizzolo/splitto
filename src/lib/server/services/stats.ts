import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { expensePayers, expenseShares, expenses } from '../db/schema';
import type { Category } from '$lib/domain/categories';

export type GroupStats = {
	total: number;
	count: number;
	byCategory: { category: Category; cents: number }[];
	/** Last 12 months, oldest first, as 'YYYY-MM'. */
	monthly: { month: string; cents: number }[];
	paidBy: { memberId: string; cents: number }[];
	consumedBy: { memberId: string; cents: number }[];
};

function lastMonths(n: number, today = new Date()): string[] {
	const out: string[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
		out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
	}
	return out;
}

export function groupStats(groupId: string): GroupStats {
	const live = and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt));
	const byCategory = db
		.select({ category: expenses.category, cents: sql<number>`sum(${expenses.amountCents})` })
		.from(expenses)
		.where(live)
		.groupBy(expenses.category)
		.all()
		.sort((a, b) => b.cents - a.cents);
	const months = lastMonths(12);
	const monthlyRows = db
		.select({
			month: sql<string>`substr(${expenses.date}, 1, 7)`,
			cents: sql<number>`sum(${expenses.amountCents})`
		})
		.from(expenses)
		.where(and(live, sql`${expenses.date} >= ${months[0] + '-01'}`))
		.groupBy(sql`substr(${expenses.date}, 1, 7)`)
		.all();
	const monthly = months.map((m) => ({
		month: m,
		cents: monthlyRows.find((r) => r.month === m)?.cents ?? 0
	}));
	const paidBy = db
		.select({
			memberId: expensePayers.memberId,
			cents: sql<number>`sum(${expensePayers.amountCents})`
		})
		.from(expensePayers)
		.innerJoin(expenses, eq(expenses.id, expensePayers.expenseId))
		.where(live)
		.groupBy(expensePayers.memberId)
		.all()
		.sort((a, b) => b.cents - a.cents);
	const consumedBy = db
		.select({
			memberId: expenseShares.memberId,
			cents: sql<number>`sum(${expenseShares.amountCents})`
		})
		.from(expenseShares)
		.innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
		.where(live)
		.groupBy(expenseShares.memberId)
		.all()
		.sort((a, b) => b.cents - a.cents);
	const totals = db
		.select({
			total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
			count: sql<number>`count(*)`
		})
		.from(expenses)
		.where(live)
		.get();
	return {
		total: totals?.total ?? 0,
		count: totals?.count ?? 0,
		byCategory,
		monthly,
		paidBy,
		consumedBy
	};
}
