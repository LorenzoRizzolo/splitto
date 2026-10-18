import { allocate, type Cents } from './money';
import type { MemberId } from './split';

// Balances are computed in the group currency (group_amount_cents columns).
// Sign convention: positive net = the member is owed money, negative = the member owes.

export type LedgerExpense = {
	payers: { memberId: MemberId; cents: Cents }[];
	shares: { memberId: MemberId; cents: Cents }[];
};
export type LedgerSettlement = { fromMemberId: MemberId; toMemberId: MemberId; cents: Cents };
export type Debt = { from: MemberId; to: MemberId; cents: Cents };

export function computeNetBalances(
	expenses: readonly LedgerExpense[],
	settlements: readonly LedgerSettlement[] = []
): Map<MemberId, Cents> {
	const net = new Map<MemberId, Cents>();
	const add = (id: MemberId, cents: Cents) => net.set(id, (net.get(id) ?? 0) + cents);
	for (const e of expenses) {
		for (const p of e.payers) add(p.memberId, p.cents);
		for (const s of e.shares) add(s.memberId, -s.cents);
	}
	// "A paid B back": A's debt shrinks (net goes up), B is owed less (net goes down).
	for (const s of settlements) {
		add(s.fromMemberId, s.cents);
		add(s.toMemberId, -s.cents);
	}
	return net;
}

/**
 * Pairwise debts without simplification: each participant owes each payer a part of their
 * share proportional to what that payer paid. Opposite debts between the same pair cancel out.
 */
export function computePairwiseDebts(
	expenses: readonly LedgerExpense[],
	settlements: readonly LedgerSettlement[] = []
): Debt[] {
	// owed.get(a).get(b) = how much a owes b (may go negative before netting).
	const owed = new Map<MemberId, Map<MemberId, Cents>>();
	const addDebt = (from: MemberId, to: MemberId, cents: Cents) => {
		if (from === to || cents === 0) return;
		// Store each pair once with a canonical orientation.
		const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
		let row = owed.get(a);
		if (!row) owed.set(a, (row = new Map()));
		row.set(b, (row.get(b) ?? 0) + sign * cents);
	};

	for (const e of expenses) {
		const paid = e.payers.filter((p) => p.cents > 0);
		if (paid.length === 0) continue;
		const weights = paid.map((p) => p.cents);
		for (const share of e.shares) {
			if (share.cents === 0) continue;
			const parts = allocate(share.cents, weights);
			paid.forEach((p, i) => addDebt(share.memberId, p.memberId, parts[i]!));
		}
	}
	for (const s of settlements) addDebt(s.toMemberId, s.fromMemberId, s.cents);

	const debts: Debt[] = [];
	for (const [a, row] of owed) {
		for (const [b, cents] of row) {
			if (cents > 0) debts.push({ from: a, to: b, cents });
			else if (cents < 0) debts.push({ from: b, to: a, cents: -cents });
		}
	}
	return sortDebts(debts);
}

export function sortDebts(debts: Debt[]): Debt[] {
	return debts.sort(
		(x, y) => y.cents - x.cents || x.from.localeCompare(y.from) || x.to.localeCompare(y.to)
	);
}

/** Net balance of one member as seen from `viewer`'s perspective in a list of debts. */
export function balanceBetween(debts: readonly Debt[], viewer: MemberId, other: MemberId): Cents {
	let total = 0;
	for (const d of debts) {
		if (d.from === other && d.to === viewer) total += d.cents;
		else if (d.from === viewer && d.to === other) total -= d.cents;
	}
	return total;
}
