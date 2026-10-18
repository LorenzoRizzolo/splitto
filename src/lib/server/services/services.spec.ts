import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { users } from '../db/schema';
import { newId } from '../db/id';
import {
	addGuest,
	addRegisteredMember,
	createGroup,
	ensureDirectGroup,
	getMembership,
	listMembers,
	requireMembership
} from './groups';
import {
	createExpense,
	deleteExpense,
	getExpenseForUser,
	listExpenses,
	restoreExpense
} from './expenses';
import { createSettlement, sendReminder } from './settlements';
import { groupBalances, friendBalances, userGroupSummaries } from './balances';
import { acceptInvite, createInvite, getInvite } from './invites';
import { createRecurring, runDueRecurring } from './recurring';
import { listActivity } from './activity';

function mkUser(name: string) {
	const id = newId();
	db.insert(users)
		.values({
			id,
			name,
			email: `${id}@test.it`.toLowerCase(),
			passwordHash: 'x',
			avatarColor: '#000'
		})
		.run();
	return id;
}

const base = { emoji: '🏠', type: 'home' as const, budgetCents: null };

describe('group flow', () => {
	const marco = mkUser('Marco');
	const giulia = mkUser('Giulia');
	const intruder = mkUser('Intruso');
	const groupId = createGroup(marco, { name: 'Casa', ...base });
	const actor = () => requireMembership(marco, groupId);

	it('protects groups from non-members', () => {
		expect(getMembership(intruder, groupId)).toBeNull();
		expect(() => requireMembership(intruder, groupId)).toThrow();
	});

	it('adds members and guests', () => {
		addRegisteredMember(
			actor(),
			db
				.select()
				.from(users)
				.all()
				.find((u) => u.id === giulia)!.email
		);
		addGuest(actor(), 'Andrea');
		const members = listMembers(groupId, marco);
		expect(members.map((m) => m.name)).toEqual(['Marco', 'Giulia', 'Andrea']);
		expect(members.find((m) => m.name === 'Andrea')!.isGuest).toBe(true);
	});

	it('creates expenses, computes balances and hides them from intruders', () => {
		const members = listMembers(groupId, marco);
		const [m, g, a] = members.map((x) => x.id) as [string, string, string];
		const id = createExpense(actor(), {
			description: 'Cena',
			amountCents: 9000,
			date: '2026-10-01',
			category: 'food',
			notes: null,
			payers: [{ memberId: m, cents: 9000 }],
			split: { mode: 'equal', members: [m, g, a] }
		});
		const b = groupBalances(actor().group);
		expect(b.net.get(m)).toBe(6000);
		expect(b.net.get(g)).toBe(-3000);
		expect(() => getExpenseForUser(intruder, id)).toThrow();
		expect(getExpenseForUser(giulia, id).expense.description).toBe('Cena');
		expect(listActivity(intruder)).toHaveLength(0);
	});

	it('rejects members from other groups in a split', () => {
		const other = createGroup(intruder, { name: 'Altro', ...base });
		const foreign = listMembers(other)[0]!.id;
		const me = listMembers(groupId, marco)[0]!.id;
		expect(() =>
			createExpense(actor(), {
				description: 'Furbata',
				amountCents: 100,
				date: '2026-10-01',
				category: 'other',
				notes: null,
				payers: [{ memberId: me, cents: 100 }],
				split: { mode: 'equal', members: [foreign] }
			})
		).toThrow(/non fa parte/);
	});

	it('soft-deletes and restores expenses', () => {
		const me = listMembers(groupId, marco)[0]!.id;
		const [first] = listExpenses(groupId, me);
		const { expense } = getExpenseForUser(marco, first!.id);
		deleteExpense(actor(), expense);
		expect(listExpenses(groupId, me)).toHaveLength(0);
		expect(listExpenses(groupId, me, {}, { trash: true })).toHaveLength(1);
		restoreExpense(actor(), getExpenseForUser(marco, first!.id).expense);
		expect(listExpenses(groupId, me)).toHaveLength(1);
	});

	it('settles up until everyone is even and limits reminders', () => {
		const [m, g, a] = listMembers(groupId, marco).map((x) => x.id) as [string, string, string];
		expect(sendReminder(actor(), g)).toEqual({ ok: true });
		expect(sendReminder(actor(), g).ok).toBe(false); // 24h limit
		expect(sendReminder(actor(), a).ok).toBe(false); // guest without account
		createSettlement(requireMembership(giulia, groupId), {
			fromMemberId: g,
			toMemberId: m,
			amountCents: 3000,
			method: 'satispay',
			date: '2026-10-02',
			note: null
		});
		const res = createSettlement(actor(), {
			fromMemberId: a,
			toMemberId: m,
			amountCents: 3000,
			method: 'cash',
			date: '2026-10-02',
			note: null
		});
		expect(res.groupSettled).toBe(true);
	});

	it('lets a new user claim a guest profile through an invite', () => {
		const andrea = listMembers(groupId).find((x) => x.name === 'Andrea')!;
		const token = createInvite(actor(), { guestMemberId: andrea.id });
		expect(getInvite(token)?.guest?.name).toBe('Andrea');
		const newUser = mkUser('Andrea Bianchi');
		acceptInvite(token, newUser, andrea.id);
		const claimed = listMembers(groupId, newUser).find((x) => x.id === andrea.id)!;
		expect(claimed.isMe).toBe(true);
		expect(claimed.name).toBe('Andrea Bianchi');
		// History is inherited: the claimed member keeps the settlement.
		expect(groupBalances(actor().group).net.get(andrea.id)).toBe(0);
	});
});

describe('friends and recurring', () => {
	it('computes friend balances across groups', () => {
		const a = mkUser('Anna');
		const b = mkUser('Bruno');
		const direct = ensureDirectGroup(a, b);
		expect(ensureDirectGroup(b, a)).toBe(direct);
		const [ma, mb] = listMembers(direct, a).map((m) => m.id) as [string, string];
		createExpense(requireMembership(a, direct), {
			description: 'Cinema',
			amountCents: 2000,
			date: '2026-10-01',
			category: 'fun',
			notes: null,
			payers: [{ memberId: ma, cents: 2000 }],
			split: { mode: 'equal', members: [ma, mb] }
		});
		const friends = friendBalances(a, userGroupSummaries(a), (gid) => listMembers(gid, a));
		expect(friends).toHaveLength(1);
		expect(friends[0]).toMatchObject({ userId: b, net: 1000, directGroupId: direct });
	});

	it('generates due recurring expenses and catches up', () => {
		const u = mkUser('Rita');
		const gid = createGroup(u, { name: 'Abbonamenti', ...base });
		const actor = requireMembership(u, gid);
		const me = listMembers(gid)[0]!.id;
		const input = {
			description: 'Netflix',
			amountCents: 1799,
			date: '2026-01-31',
			category: 'bills' as const,
			notes: null,
			payers: [{ memberId: me, cents: 1799 }],
			split: { mode: 'equal' as const, members: [me] }
		};
		createExpense(actor, input);
		createRecurring(actor, input, 'monthly');
		// Feb 28 and Mar 31 are due; Apr 30 is still in the future.
		expect(runDueRecurring('2026-04-15')).toBe(2);
		expect(listExpenses(gid, me).map((e) => e.date)).toEqual([
			'2026-03-31',
			'2026-02-28',
			'2026-01-31'
		]);
		expect(runDueRecurring('2026-04-15')).toBe(0);
	});
});
