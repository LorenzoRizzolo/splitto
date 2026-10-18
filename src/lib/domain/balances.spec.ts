import { describe, expect, it } from 'vitest';
import { computeNetBalances, computePairwiseDebts, type LedgerExpense } from './balances';
import { simplifyDebts } from './simplify';
import { sum } from './money';

const dinner: LedgerExpense = {
	// 90 € dinner, Marco paid, split among 3.
	payers: [{ memberId: 'marco', cents: 9000 }],
	shares: [
		{ memberId: 'marco', cents: 3000 },
		{ memberId: 'giulia', cents: 3000 },
		{ memberId: 'luca', cents: 3000 }
	]
};

describe('net balances', () => {
	it('computes who is owed and who owes', () => {
		const net = computeNetBalances([dinner]);
		expect(Object.fromEntries(net)).toEqual({ marco: 6000, giulia: -3000, luca: -3000 });
		expect(sum([...net.values()])).toBe(0);
	});

	it('applies settlements', () => {
		const net = computeNetBalances(
			[dinner],
			[{ fromMemberId: 'giulia', toMemberId: 'marco', cents: 3000 }]
		);
		expect(Object.fromEntries(net)).toEqual({ marco: 3000, giulia: 0, luca: -3000 });
	});

	it('handles multiple payers', () => {
		const net = computeNetBalances([
			{
				payers: [
					{ memberId: 'marco', cents: 3000 },
					{ memberId: 'giulia', cents: 2000 }
				],
				shares: [
					{ memberId: 'marco', cents: 2500 },
					{ memberId: 'giulia', cents: 2500 }
				]
			}
		]);
		expect(Object.fromEntries(net)).toEqual({ marco: 500, giulia: -500 });
	});
});

describe('pairwise debts', () => {
	it('lists who owes whom without simplification', () => {
		expect(computePairwiseDebts([dinner])).toEqual([
			{ from: 'giulia', to: 'marco', cents: 3000 },
			{ from: 'luca', to: 'marco', cents: 3000 }
		]);
	});

	it('nets opposite debts between the same pair', () => {
		const back: LedgerExpense = {
			payers: [{ memberId: 'giulia', cents: 2000 }],
			shares: [
				{ memberId: 'giulia', cents: 1000 },
				{ memberId: 'marco', cents: 1000 }
			]
		};
		expect(computePairwiseDebts([dinner, back])).toEqual([
			{ from: 'luca', to: 'marco', cents: 3000 },
			{ from: 'giulia', to: 'marco', cents: 2000 }
		]);
	});

	it('splits a share across multiple payers proportionally', () => {
		const debts = computePairwiseDebts([
			{
				payers: [
					{ memberId: 'a', cents: 3000 },
					{ memberId: 'b', cents: 1000 }
				],
				shares: [
					{ memberId: 'a', cents: 1000 },
					{ memberId: 'b', cents: 1000 },
					{ memberId: 'c', cents: 1000 },
					{ memberId: 'd', cents: 1000 }
				]
			}
		]);
		// b owes a 750, but a owes b 250 → b owes a 500. c and d owe a 750 and b 250 each.
		expect(debts).toEqual([
			{ from: 'c', to: 'a', cents: 750 },
			{ from: 'd', to: 'a', cents: 750 },
			{ from: 'b', to: 'a', cents: 500 },
			{ from: 'c', to: 'b', cents: 250 },
			{ from: 'd', to: 'b', cents: 250 }
		]);
	});

	it('removes debts that are fully settled', () => {
		const debts = computePairwiseDebts(
			[dinner],
			[
				{ fromMemberId: 'giulia', toMemberId: 'marco', cents: 3000 },
				{ fromMemberId: 'luca', toMemberId: 'marco', cents: 1000 }
			]
		);
		expect(debts).toEqual([{ from: 'luca', to: 'marco', cents: 2000 }]);
	});
});

describe('debt simplification', () => {
	function applyTransfers(
		net: Record<string, number>,
		transfers: { from: string; to: string; cents: number }[]
	) {
		const out = { ...net };
		for (const t of transfers) {
			out[t.from] = (out[t.from] ?? 0) + t.cents;
			out[t.to] = (out[t.to] ?? 0) - t.cents;
		}
		return out;
	}

	it('turns a chain A→B→C into a single transfer A→C', () => {
		// A owes B 10, B owes C 10 → net A -10, B 0, C +10.
		expect(simplifyDebts({ a: -1000, b: 0, c: 1000 })).toEqual([
			{ from: 'a', to: 'c', cents: 1000 }
		]);
	});

	it('matches the largest creditor with the largest debtor', () => {
		const net = { a: 5000, b: 1000, c: -4000, d: -2000 };
		const t = simplifyDebts(net);
		expect(t[0]).toEqual({ from: 'c', to: 'a', cents: 4000 });
		expect(t).toHaveLength(3);
		expect(Object.values(applyTransfers(net, t)).every((v) => v === 0)).toBe(true);
	});

	it('uses at most n-1 transfers and settles everyone', () => {
		const net = { a: 1234, b: -567, c: 890, d: -1001, e: -556, f: 0 };
		const t = simplifyDebts(net);
		expect(t.length).toBeLessThanOrEqual(Object.keys(net).length - 1);
		expect(t.every((x) => x.cents > 0)).toBe(true);
		expect(Object.values(applyTransfers(net, t)).every((v) => v === 0)).toBe(true);
	});

	it('returns nothing when everybody is even', () => {
		expect(simplifyDebts({})).toEqual([]);
		expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
	});

	it('is deterministic on ties', () => {
		const net = { z: 100, y: 100, x: -100, w: -100 };
		expect(simplifyDebts(net)).toEqual(simplifyDebts(new Map(Object.entries(net).reverse())));
	});

	it('rejects unbalanced input', () => {
		expect(() => simplifyDebts({ a: 100, b: -99 })).toThrow();
	});

	it('works with single cents and a random fuzz', () => {
		let seed = 42;
		const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
		for (let round = 0; round < 200; round++) {
			const n = 2 + Math.floor(rand() * 8);
			const values = Array.from({ length: n - 1 }, () => Math.floor(rand() * 20001) - 10000);
			values.push(-sum(values));
			const net = Object.fromEntries(values.map((v, i) => [`m${i}`, v]));
			const t = simplifyDebts(net);
			expect(t.length).toBeLessThanOrEqual(n - 1);
			expect(Object.values(applyTransfers(net, t)).every((v) => v === 0)).toBe(true);
		}
	});
});
