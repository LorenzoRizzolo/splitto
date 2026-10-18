import type { Cents } from './money';
import { sortDebts, type Debt } from './balances';
import type { MemberId } from './split';

/**
 * Greedy debt simplification: repeatedly match the largest creditor with the largest debtor
 * and settle the smaller of the two amounts. Produces at most n-1 transfers and preserves
 * every member's net balance. Ties are broken by member id so the result is deterministic.
 */
export function simplifyDebts(net: ReadonlyMap<MemberId, Cents> | Record<MemberId, Cents>): Debt[] {
	const entries = net instanceof Map ? [...net.entries()] : Object.entries(net);
	const total = entries.reduce((acc, [, v]) => acc + v, 0);
	if (total !== 0) throw new RangeError(`Net balances must sum to zero (got ${total})`);

	const creditors = entries.filter(([, v]) => v > 0).map(([id, v]) => ({ id, amount: v }));
	const debtors = entries.filter(([, v]) => v < 0).map(([id, v]) => ({ id, amount: -v }));
	const byAmount = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
		b.amount - a.amount || a.id.localeCompare(b.id);

	const transfers: Debt[] = [];
	while (creditors.length > 0 && debtors.length > 0) {
		creditors.sort(byAmount);
		debtors.sort(byAmount);
		const c = creditors[0]!;
		const d = debtors[0]!;
		const amount = Math.min(c.amount, d.amount);
		transfers.push({ from: d.id, to: c.id, cents: amount });
		c.amount -= amount;
		d.amount -= amount;
		if (c.amount === 0) creditors.shift();
		if (d.amount === 0) debtors.shift();
	}
	return sortDebts(transfers);
}
