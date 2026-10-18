import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import {
	expensePayers,
	expenseShares,
	expenses,
	groupMembers,
	groups,
	settlements,
	type Group
} from '../db/schema';
import {
	balanceBetween,
	computeNetBalances,
	type Debt,
	type LedgerExpense,
	type LedgerSettlement
} from '$lib/domain/balances';
import { simplifyDebts } from '$lib/domain/simplify';

export type GroupBalances = {
	/** Net per member id: > 0 is owed money, < 0 owes. Members with 0 are included. */
	net: Map<string, number>;
	/** Who should pay whom (always simplified). */
	debts: Debt[];
	/** True when nobody owes anything. */
	settled: boolean;
};

export function loadLedger(groupId: string): {
	expenses: LedgerExpense[];
	settlements: LedgerSettlement[];
} {
	const live = and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt));
	const payers = db
		.select({
			expenseId: expensePayers.expenseId,
			memberId: expensePayers.memberId,
			cents: expensePayers.amountCents
		})
		.from(expensePayers)
		.innerJoin(expenses, eq(expenses.id, expensePayers.expenseId))
		.where(live)
		.all();
	const shares = db
		.select({
			expenseId: expenseShares.expenseId,
			memberId: expenseShares.memberId,
			cents: expenseShares.amountCents
		})
		.from(expenseShares)
		.innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
		.where(live)
		.all();
	const byExpense = new Map<string, LedgerExpense>();
	const get = (id: string) => {
		let e = byExpense.get(id);
		if (!e) byExpense.set(id, (e = { payers: [], shares: [] }));
		return e;
	};
	for (const p of payers) get(p.expenseId).payers.push({ memberId: p.memberId, cents: p.cents });
	for (const s of shares) get(s.expenseId).shares.push({ memberId: s.memberId, cents: s.cents });

	const st = db
		.select({
			fromMemberId: settlements.fromMemberId,
			toMemberId: settlements.toMemberId,
			cents: settlements.amountCents
		})
		.from(settlements)
		.where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt)))
		.all();
	return { expenses: [...byExpense.values()], settlements: st };
}

export function groupBalances(group: Pick<Group, 'id'>): GroupBalances {
	const ledger = loadLedger(group.id);
	const net = computeNetBalances(ledger.expenses, ledger.settlements);
	const memberIds = db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(eq(groupMembers.groupId, group.id))
		.all();
	for (const { id } of memberIds) if (!net.has(id)) net.set(id, 0);
	// Debts are always simplified: the fewest payments that settle everyone.
	const debts = simplifyDebts(net);
	return { net, debts, settled: [...net.values()].every((v) => v === 0) };
}

export function memberNet(group: Pick<Group, 'id'>, memberId: string): number {
	return groupBalances(group).net.get(memberId) ?? 0;
}

export type GroupSummary = {
	group: Group;
	memberId: string;
	myNet: number;
	balances: GroupBalances;
};

/** Every group (and direct group) the user is an active member of, with balances. */
export function userGroupSummaries(userId: string): GroupSummary[] {
	const rows = db
		.select({ group: groups, memberId: groupMembers.id })
		.from(groupMembers)
		.innerJoin(groups, eq(groups.id, groupMembers.groupId))
		.where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)))
		.all();
	return rows.map(({ group, memberId }) => {
		const balances = groupBalances(group);
		return { group, memberId, myNet: balances.net.get(memberId) ?? 0, balances };
	});
}

export type FriendBalance = {
	/** Registered friend user id, or null for a guest friend (direct group with a guest). */
	userId: string | null;
	name: string;
	avatarUrl: string | null;
	avatarColor: string | null;
	/** > 0: the friend owes me. */
	net: number;
	directGroupId: string | null;
	byGroup: { groupId: string; groupName: string; kind: 'group' | 'direct'; net: number }[];
};

/**
 * Balances with each person the user shares a group with (registered users merged across
 * groups; guests listed only for direct groups). Based on each group's displayed debts.
 */
export function friendBalances(
	userId: string,
	summaries: GroupSummary[],
	members: (groupId: string) => {
		id: string;
		userId: string | null;
		name: string;
		avatarUrl: string | null;
		avatarColor: string | null;
		isMe: boolean;
	}[]
): FriendBalance[] {
	const friends = new Map<string, FriendBalance>();
	for (const s of summaries) {
		for (const m of members(s.group.id)) {
			if (m.isMe) continue;
			if (!m.userId && s.group.kind !== 'direct') continue;
			const key = m.userId ?? `guest:${m.id}`;
			let f = friends.get(key);
			if (!f) {
				f = {
					userId: m.userId,
					name: m.name,
					avatarUrl: m.avatarUrl,
					avatarColor: m.avatarColor,
					net: 0,
					directGroupId: null,
					byGroup: []
				};
				friends.set(key, f);
			}
			const net = balanceBetween(s.balances.debts, s.memberId, m.id);
			if (s.group.kind === 'direct') f.directGroupId = s.group.id;
			f.net += net;
			if (net !== 0 || s.group.kind === 'direct') {
				f.byGroup.push({ groupId: s.group.id, groupName: s.group.name, kind: s.group.kind, net });
			}
		}
	}
	return [...friends.values()].sort(
		(a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name, 'it')
	);
}

/** Whether every balance of the user is zero (required to delete the account). */
export function userIsSettled(userId: string): boolean {
	return userGroupSummaries(userId).every((s) => s.myNet === 0);
}

export function memberIdsOfUser(userId: string, groupIds: string[]): string[] {
	if (groupIds.length === 0) return [];
	return db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(and(eq(groupMembers.userId, userId), inArray(groupMembers.groupId, groupIds)))
		.all()
		.map((r) => r.id);
}
