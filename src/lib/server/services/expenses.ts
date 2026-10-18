import { error } from '@sveltejs/kit';
import { and, desc, eq, exists, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import type { Executor } from '../db/client';
import { newId } from '../db/id';
import {
	expenseComments,
	expensePayers,
	expenseShares,
	expenses,
	groupMembers,
	groups,
	users,
	type Expense
} from '../db/schema';
import { materializeExpense, splitMemberIds } from '$lib/domain/expense';
import type { SplitInput } from '$lib/domain/split';
import type { Category } from '$lib/domain/categories';
import { formatMoney } from '$lib/domain/money';
import { logActivity } from './activity';
import { notify } from './notify';
import { requireNotArchived, type Actor } from './groups';

export type ExpenseInput = {
	description: string;
	amountCents: number;
	date: string;
	category: Category;
	notes: string | null;
	payers: { memberId: string; cents: number }[];
	split: SplitInput;
};

export class ExpenseValidationError extends Error {
	constructor(
		public field: string,
		message: string
	) {
		super(message);
	}
}

function memberUserIds(ex: Executor, memberIds: string[]): string[] {
	if (memberIds.length === 0) return [];
	return ex
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(inArray(groupMembers.id, memberIds))
		.all()
		.map((r) => r.userId)
		.filter((id): id is string => !!id);
}

/** Validates the input against the group members and computes rows. Throws ExpenseValidationError. */
function prepare(ex: Executor, groupId: string, input: ExpenseInput, allowInactive: string[] = []) {
	const ids = new Set([...input.payers.map((p) => p.memberId), ...splitMemberIds(input.split)]);
	const members = ex
		.select({ id: groupMembers.id, leftAt: groupMembers.leftAt })
		.from(groupMembers)
		.where(eq(groupMembers.groupId, groupId))
		.all();
	const known = new Map(members.map((m) => [m.id, m]));
	for (const id of ids) {
		const m = known.get(id);
		// Members that left can only appear in expenses they were already part of.
		if (!m || (m.leftAt && !allowInactive.includes(id))) {
			throw new ExpenseValidationError(
				'split',
				'Una delle persone selezionate non fa parte del gruppo'
			);
		}
	}
	const result = materializeExpense({
		amountCents: input.amountCents,
		payers: input.payers,
		split: input.split
	});
	if (!result.ok) throw new ExpenseValidationError(result.field, result.message);
	return result.value;
}

function writeRows(ex: Executor, expenseId: string, rows: ReturnType<typeof prepare>) {
	ex.delete(expensePayers).where(eq(expensePayers.expenseId, expenseId)).run();
	ex.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId)).run();
	for (const p of rows.payers) {
		ex.insert(expensePayers)
			.values({ expenseId, memberId: p.memberId, amountCents: p.cents })
			.run();
	}
	for (const s of rows.shares) {
		ex.insert(expenseShares)
			.values({ expenseId, memberId: s.memberId, amountCents: s.cents })
			.run();
	}
}

/** Inserts an expense. Used by the UI and by the recurring-expense job. */
export function insertExpense(
	ex: Executor,
	args: {
		groupId: string;
		actorUserId: string | null;
		input: ExpenseInput;
		receiptPath?: string | null;
		recurringId?: string | null;
	}
): { id: string; involvedUserIds: string[] } {
	const rows = prepare(ex, args.groupId, args.input);
	const id = newId();
	ex.insert(expenses)
		.values({
			id,
			groupId: args.groupId,
			description: args.input.description,
			category: args.input.category,
			date: args.input.date,
			amountCents: args.input.amountCents,
			splitMode: args.input.split.mode,
			splitInput: args.input.split,
			notes: args.input.notes,
			receiptPath: args.receiptPath ?? null,
			recurringId: args.recurringId ?? null,
			createdBy: args.actorUserId
		})
		.run();
	writeRows(ex, id, rows);
	logActivity(ex, {
		groupId: args.groupId,
		actorUserId: args.actorUserId,
		type: args.recurringId && !args.actorUserId ? 'recurring_generated' : 'expense_created',
		entityId: id,
		data: { description: args.input.description, amountCents: args.input.amountCents }
	});
	const involved = memberUserIds(ex, [
		...new Set([...rows.payers, ...rows.shares].map((r) => r.memberId))
	]);
	return { id, involvedUserIds: involved };
}

export function createExpense(
	actor: Actor,
	input: ExpenseInput,
	receiptPath: string | null = null
): string {
	requireNotArchived(actor);
	const { id, involvedUserIds } = db.transaction((tx) =>
		insertExpense(tx, { groupId: actor.group.id, actorUserId: actor.userId, input, receiptPath })
	);
	notify(
		involvedUserIds.filter((u) => u !== actor.userId),
		'expense_added',
		{
			title: `Nuova spesa: ${input.description}`,
			body: `${formatMoney(input.amountCents)} in ${actor.group.kind === 'direct' ? 'spese tra amici' : actor.group.name}`,
			url: `/app/expenses/${id}`
		}
	);
	checkBudget(actor.group.id);
	return id;
}

export function getExpenseForUser(
	userId: string,
	expenseId: string
): { expense: Expense; actor: Actor } {
	const row = db
		.select({ expense: expenses, group: groups, member: groupMembers })
		.from(expenses)
		.innerJoin(groups, eq(groups.id, expenses.groupId))
		.innerJoin(
			groupMembers,
			and(
				eq(groupMembers.groupId, expenses.groupId),
				eq(groupMembers.userId, userId),
				isNull(groupMembers.leftAt)
			)
		)
		.where(eq(expenses.id, expenseId))
		.get();
	if (!row) error(404, 'Spesa non trovata');
	return { expense: row.expense, actor: { userId, group: row.group, member: row.member } };
}

export function canEditExpense(actor: Actor, expense: Pick<Expense, 'createdBy'>): boolean {
	return expense.createdBy === actor.userId || actor.member.role === 'admin';
}

function requireEditable(actor: Actor, expense: Expense) {
	requireNotArchived(actor);
	if (!canEditExpense(actor, expense)) {
		error(403, 'Puoi modificare solo le spese che hai inserito tu (o se sei amministratore)');
	}
}

export function updateExpense(
	actor: Actor,
	expense: Expense,
	input: ExpenseInput,
	receiptPath?: string | null
) {
	requireEditable(actor, expense);
	if (expense.deletedAt) error(409, 'La spesa è nel cestino: ripristinala prima di modificarla');
	const involvedUserIds = db.transaction((tx) => {
		const previous = [
			...tx
				.select({ id: expensePayers.memberId })
				.from(expensePayers)
				.where(eq(expensePayers.expenseId, expense.id))
				.all(),
			...tx
				.select({ id: expenseShares.memberId })
				.from(expenseShares)
				.where(eq(expenseShares.expenseId, expense.id))
				.all()
		].map((r) => r.id);
		const rows = prepare(tx, expense.groupId, input, previous);
		tx.update(expenses)
			.set({
				description: input.description,
				category: input.category,
				date: input.date,
				amountCents: input.amountCents,
				splitMode: input.split.mode,
				splitInput: input.split,
				notes: input.notes,
				...(receiptPath !== undefined ? { receiptPath } : {}),
				updatedAt: new Date()
			})
			.where(eq(expenses.id, expense.id))
			.run();
		writeRows(tx, expense.id, rows);

		const changes: string[] = [];
		if (expense.amountCents !== input.amountCents)
			changes.push(
				`importo da ${formatMoney(expense.amountCents)} a ${formatMoney(input.amountCents)}`
			);
		if (expense.description !== input.description)
			changes.push(`descrizione da “${expense.description}”`);
		if (expense.date !== input.date) changes.push('data');
		if (
			expense.splitMode !== input.split.mode ||
			JSON.stringify(expense.splitInput) !== JSON.stringify(input.split)
		)
			changes.push('divisione');
		logActivity(tx, {
			groupId: expense.groupId,
			actorUserId: actor.userId,
			type: 'expense_updated',
			entityId: expense.id,
			data: { description: input.description, amountCents: input.amountCents, changes }
		});
		return memberUserIds(tx, [
			...new Set([
				...previous,
				...rows.payers.map((p) => p.memberId),
				...rows.shares.map((s) => s.memberId)
			])
		]);
	});
	notify(
		involvedUserIds.filter((u) => u !== actor.userId),
		'expense_updated',
		{
			title: `Spesa modificata: ${input.description}`,
			body: formatMoney(input.amountCents),
			url: `/app/expenses/${expense.id}`
		}
	);
	checkBudget(expense.groupId);
}

export function deleteExpense(actor: Actor, expense: Expense) {
	requireEditable(actor, expense);
	if (expense.deletedAt) return;
	db.transaction((tx) => {
		tx.update(expenses)
			.set({ deletedAt: new Date(), deletedBy: actor.userId })
			.where(eq(expenses.id, expense.id))
			.run();
		logActivity(tx, {
			groupId: expense.groupId,
			actorUserId: actor.userId,
			type: 'expense_deleted',
			entityId: expense.id,
			data: { description: expense.description, amountCents: expense.amountCents }
		});
	});
}

export function restoreExpense(actor: Actor, expense: Expense) {
	requireEditable(actor, expense);
	if (!expense.deletedAt) return;
	db.transaction((tx) => {
		tx.update(expenses)
			.set({ deletedAt: null, deletedBy: null })
			.where(eq(expenses.id, expense.id))
			.run();
		logActivity(tx, {
			groupId: expense.groupId,
			actorUserId: actor.userId,
			type: 'expense_restored',
			entityId: expense.id,
			data: { description: expense.description, amountCents: expense.amountCents }
		});
	});
}

/** Sends the 80% budget alert once per budget value. */
export function checkBudget(groupId: string) {
	const group = db.select().from(groups).where(eq(groups.id, groupId)).get();
	if (!group?.budgetCents || group.budgetAlertSentAt) return;
	const spent = groupSpent(groupId);
	if (spent * 100 < group.budgetCents * 80) return;
	db.update(groups).set({ budgetAlertSentAt: new Date() }).where(eq(groups.id, groupId)).run();
	const memberUsers = db
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)))
		.all()
		.map((m) => m.userId);
	const pct = Math.floor((spent * 100) / group.budgetCents);
	notify(memberUsers, 'budget_alert', {
		title: `${group.emoji} Budget al ${pct}%`,
		body: `${group.name}: spesi ${formatMoney(spent)} su ${formatMoney(group.budgetCents)}`,
		url: `/app/groups/${groupId}`
	});
}

export function groupSpent(groupId: string): number {
	return (
		db
			.select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
			.from(expenses)
			.where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)))
			.get()?.total ?? 0
	);
}

// --- Listing ---------------------------------------------------------------------------------

export type ExpenseFilters = {
	q?: string;
	category?: Category;
	memberId?: string;
	from?: string;
	to?: string;
};

export type ExpenseListItem = {
	id: string;
	description: string;
	notes: string | null;
	category: Category;
	date: string;
	amountCents: number;
	splitMode: Expense['splitMode'];
	hasReceipt: boolean;
	recurring: boolean;
	payers: { memberId: string; cents: number }[];
	/** Viewer's net for this expense: paid − share (> 0: lent, < 0: borrowed). */
	myNet: number;
	myShare: number;
	deletedAt: Date | null;
	createdBy: string | null;
};

function escapeLike(s: string) {
	return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function listExpenses(
	groupId: string,
	viewerMemberId: string,
	filters: ExpenseFilters = {},
	opts: { trash?: boolean; limit?: number } = {}
): ExpenseListItem[] {
	const conds = [
		eq(expenses.groupId, groupId),
		opts.trash ? isNotNull(expenses.deletedAt) : isNull(expenses.deletedAt)
	];
	if (filters.q) {
		const q = `%${escapeLike(filters.q)}%`;
		conds.push(
			or(
				sql`${expenses.description} like ${q} escape '\\'`,
				sql`${expenses.notes} like ${q} escape '\\'`
			)!
		);
	}
	if (filters.category) conds.push(eq(expenses.category, filters.category));
	if (filters.from) conds.push(gte(expenses.date, filters.from));
	if (filters.to) conds.push(lte(expenses.date, filters.to));
	if (filters.memberId) {
		const m = filters.memberId;
		conds.push(
			or(
				exists(
					db
						.select({ x: sql`1` })
						.from(expensePayers)
						.where(and(eq(expensePayers.expenseId, expenses.id), eq(expensePayers.memberId, m)))
				),
				exists(
					db
						.select({ x: sql`1` })
						.from(expenseShares)
						.where(and(eq(expenseShares.expenseId, expenses.id), eq(expenseShares.memberId, m)))
				)
			)!
		);
	}
	const rows = db
		.select()
		.from(expenses)
		.where(and(...conds))
		.orderBy(desc(expenses.date), desc(expenses.createdAt))
		.limit(opts.limit ?? 500)
		.all();
	if (rows.length === 0) return [];
	const ids = rows.map((r) => r.id);
	const payers = db.select().from(expensePayers).where(inArray(expensePayers.expenseId, ids)).all();
	const shares = db
		.select()
		.from(expenseShares)
		.where(and(inArray(expenseShares.expenseId, ids), eq(expenseShares.memberId, viewerMemberId)))
		.all();
	return rows.map((e) => {
		const ps = payers
			.filter((p) => p.expenseId === e.id)
			.map((p) => ({ memberId: p.memberId, cents: p.amountCents }));
		const paid = ps.find((p) => p.memberId === viewerMemberId)?.cents ?? 0;
		const share = shares.find((s) => s.expenseId === e.id)?.amountCents ?? 0;
		return {
			id: e.id,
			description: e.description,
			notes: e.notes,
			category: e.category,
			date: e.date,
			amountCents: e.amountCents,
			splitMode: e.splitMode,
			hasReceipt: !!e.receiptPath,
			recurring: !!e.recurringId,
			payers: ps,
			myNet: paid - share,
			myShare: share,
			deletedAt: e.deletedAt,
			createdBy: e.createdBy
		};
	});
}

export function getExpenseDetail(expenseId: string) {
	const payers = db
		.select()
		.from(expensePayers)
		.where(eq(expensePayers.expenseId, expenseId))
		.all();
	const shares = db
		.select()
		.from(expenseShares)
		.where(eq(expenseShares.expenseId, expenseId))
		.all();
	const comments = db
		.select({
			id: expenseComments.id,
			body: expenseComments.body,
			createdAt: expenseComments.createdAt,
			userId: expenseComments.userId,
			userName: users.name
		})
		.from(expenseComments)
		.leftJoin(users, eq(users.id, expenseComments.userId))
		.where(eq(expenseComments.expenseId, expenseId))
		.orderBy(expenseComments.createdAt)
		.all();
	return { payers, shares, comments };
}

export function addComment(actor: Actor, expense: Expense, body: string) {
	db.transaction((tx) => {
		tx.insert(expenseComments)
			.values({ id: newId(), expenseId: expense.id, userId: actor.userId, body })
			.run();
		logActivity(tx, {
			groupId: expense.groupId,
			actorUserId: actor.userId,
			type: 'comment_added',
			entityId: expense.id,
			data: { description: expense.description, body: body.slice(0, 120) }
		});
	});
}

export function deleteComment(actor: Actor, commentId: string) {
	db.delete(expenseComments)
		.where(and(eq(expenseComments.id, commentId), eq(expenseComments.userId, actor.userId)))
		.run();
}

/** Most recent group the user added an expense to (for the quick-add button). */
export function lastUsedGroupId(userId: string): string | null {
	const row = db
		.select({ groupId: expenses.groupId })
		.from(expenses)
		.innerJoin(groups, eq(groups.id, expenses.groupId))
		.innerJoin(
			groupMembers,
			and(
				eq(groupMembers.groupId, expenses.groupId),
				eq(groupMembers.userId, userId),
				isNull(groupMembers.leftAt)
			)
		)
		.where(and(eq(expenses.createdBy, userId), isNull(groups.archivedAt)))
		.orderBy(desc(expenses.createdAt))
		.limit(1)
		.get();
	return row?.groupId ?? null;
}
