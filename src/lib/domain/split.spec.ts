import { describe, expect, it } from 'vitest';
import { computeSplit, parsePercent, validatePayers, type SplitResult } from './split';
import { sum } from './money';

function shares(result: SplitResult) {
	if (!result.ok) throw new Error(`Expected ok, got ${result.code}: ${result.message}`);
	return Object.fromEntries(result.shares.map((s) => [s.memberId, s.cents]));
}

function total(result: SplitResult) {
	if (!result.ok) throw new Error(result.message);
	return sum(result.shares.map((s) => s.cents));
}

describe('equal split', () => {
	it('splits 10 € among 3 with deterministic leftover cents', () => {
		const r = computeSplit(1000, { mode: 'equal', members: ['a', 'b', 'c'] });
		expect(shares(r)).toEqual({ a: 334, b: 333, c: 333 });
	});

	it('splits among a selection only', () => {
		const r = computeSplit(9000, { mode: 'equal', members: ['b', 'c'] });
		expect(shares(r)).toEqual({ b: 4500, c: 4500 });
	});

	it('always matches the total', () => {
		for (let t = 0; t < 1000; t += 13) {
			expect(
				total(computeSplit(t, { mode: 'equal', members: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }))
			).toBe(t);
		}
	});

	it('requires members and rejects duplicates', () => {
		expect(computeSplit(100, { mode: 'equal', members: [] })).toMatchObject({
			ok: false,
			code: 'no_members'
		});
		expect(computeSplit(100, { mode: 'equal', members: ['a', 'a'] })).toMatchObject({
			ok: false,
			code: 'duplicate_member'
		});
	});
});

describe('exact split', () => {
	it('accepts amounts that sum to the total', () => {
		const r = computeSplit(5000, {
			mode: 'exact',
			amounts: [
				{ memberId: 'a', cents: 3000 },
				{ memberId: 'b', cents: 2000 },
				{ memberId: 'c', cents: 0 }
			]
		});
		expect(shares(r)).toEqual({ a: 3000, b: 2000 });
	});

	it('reports how much is missing or exceeding', () => {
		const missing = computeSplit(5000, {
			mode: 'exact',
			amounts: [{ memberId: 'a', cents: 2500 }]
		});
		expect(missing).toMatchObject({ ok: false, code: 'exact_mismatch', diff: 2500 });
		expect(!missing.ok && missing.message).toBe('Mancano 25,00 €');

		const excess = computeSplit(5000, { mode: 'exact', amounts: [{ memberId: 'a', cents: 5100 }] });
		expect(excess).toMatchObject({ ok: false, diff: -100 });
		expect(!excess.ok && excess.message).toBe('Avanzano 1,00 €');
	});

	it('rejects negative amounts', () => {
		expect(
			computeSplit(0, {
				mode: 'exact',
				amounts: [
					{ memberId: 'a', cents: -1 },
					{ memberId: 'b', cents: 1 }
				]
			})
		).toMatchObject({
			ok: false,
			code: 'invalid_value'
		});
	});
});

describe('percent split', () => {
	it('splits by percentages summing to 100%', () => {
		const r = computeSplit(10000, {
			mode: 'percent',
			percents: [
				{ memberId: 'a', basisPoints: 5000 },
				{ memberId: 'b', basisPoints: 3000 },
				{ memberId: 'c', basisPoints: 2000 }
			]
		});
		expect(shares(r)).toEqual({ a: 5000, b: 3000, c: 2000 });
	});

	it('handles 33.33/33.33/33.34 without losing cents', () => {
		const r = computeSplit(100, {
			mode: 'percent',
			percents: [
				{ memberId: 'a', basisPoints: 3333 },
				{ memberId: 'b', basisPoints: 3333 },
				{ memberId: 'c', basisPoints: 3334 }
			]
		});
		expect(total(r)).toBe(100);
		expect(shares(r)).toEqual({ a: 33, b: 33, c: 34 });
	});

	it('rejects totals different from 100%', () => {
		const r = computeSplit(100, {
			mode: 'percent',
			percents: [{ memberId: 'a', basisPoints: 9000 }]
		});
		expect(r).toMatchObject({ ok: false, code: 'percent_mismatch', diff: 1000 });
		expect(!r.ok && r.message).toBe('Manca il 10%');
		const over = computeSplit(100, {
			mode: 'percent',
			percents: [
				{ memberId: 'a', basisPoints: 9000 },
				{ memberId: 'b', basisPoints: 1050 }
			]
		});
		expect(!over.ok && over.message).toBe('Avanza il 0,5%');
	});

	it('parses user-typed percentages', () => {
		expect(parsePercent('33,33')).toBe(3333);
		expect(parsePercent('50')).toBe(5000);
		expect(parsePercent('12.5')).toBe(1250);
		expect(parsePercent('100')).toBe(10000);
		expect(parsePercent('101')).toBeNull();
		expect(parsePercent('1,234')).toBeNull();
	});
});

describe('shares split', () => {
	it('gives 2 shares to Marco and 1 to Giulia', () => {
		const r = computeSplit(9000, {
			mode: 'shares',
			shares: [
				{ memberId: 'marco', shares: 2 },
				{ memberId: 'giulia', shares: 1 }
			]
		});
		expect(shares(r)).toEqual({ marco: 6000, giulia: 3000 });
	});

	it('supports fractional shares and members with zero shares', () => {
		const r = computeSplit(1000, {
			mode: 'shares',
			shares: [
				{ memberId: 'a', shares: 1.5 },
				{ memberId: 'b', shares: 1 },
				{ memberId: 'c', shares: 0 }
			]
		});
		expect(shares(r)).toEqual({ a: 600, b: 400 });
	});

	it('rejects invalid shares', () => {
		expect(
			computeSplit(100, { mode: 'shares', shares: [{ memberId: 'a', shares: 0 }] })
		).toMatchObject({ code: 'no_members' });
		expect(
			computeSplit(100, { mode: 'shares', shares: [{ memberId: 'a', shares: -1 }] })
		).toMatchObject({ code: 'invalid_value' });
		expect(
			computeSplit(100, { mode: 'shares', shares: [{ memberId: 'a', shares: 1.234 }] })
		).toMatchObject({ code: 'invalid_value' });
	});
});

describe('adjust split', () => {
	it('splits equally after applying adjustments', () => {
		// 100 € among 3, Marco +10 € (e.g. he had dessert): remaining 90 € → 30 € each.
		const r = computeSplit(10000, {
			mode: 'adjust',
			members: ['marco', 'giulia', 'luca'],
			adjustments: [{ memberId: 'marco', cents: 1000 }]
		});
		expect(shares(r)).toEqual({ marco: 4000, giulia: 3000, luca: 3000 });
	});

	it('supports negative adjustments', () => {
		const r = computeSplit(9000, {
			mode: 'adjust',
			members: ['a', 'b', 'c'],
			adjustments: [{ memberId: 'c', cents: -1500 }]
		});
		expect(shares(r)).toEqual({ a: 3500, b: 3500, c: 2000 });
		expect(total(r)).toBe(9000);
	});

	it('rejects adjustments exceeding the total or producing negative shares', () => {
		expect(
			computeSplit(1000, {
				mode: 'adjust',
				members: ['a', 'b'],
				adjustments: [{ memberId: 'a', cents: 1500 }]
			})
		).toMatchObject({
			code: 'adjust_overflow'
		});
		expect(
			computeSplit(1000, {
				mode: 'adjust',
				members: ['a', 'b'],
				adjustments: [{ memberId: 'a', cents: -2000 }]
			})
		).toMatchObject({
			code: 'negative_share'
		});
		expect(
			computeSplit(1000, {
				mode: 'adjust',
				members: ['a'],
				adjustments: [{ memberId: 'z', cents: 1 }]
			})
		).toMatchObject({
			code: 'invalid_value'
		});
	});
});

describe('itemized split', () => {
	it('assigns items and spreads tax and tip proportionally', () => {
		// Pizza 10 € (a), pasta 20 € (b), wine 12 € shared (a, b, c); tax 4,20 €, tip 0.
		const r = computeSplit(4620, {
			mode: 'itemized',
			items: [
				{ name: 'Pizza', cents: 1000, memberIds: ['a'] },
				{ name: 'Pasta', cents: 2000, memberIds: ['b'] },
				{ name: 'Vino', cents: 1200, memberIds: ['a', 'b', 'c'] }
			],
			taxCents: 420,
			tipCents: 0
		});
		// Subtotals: a 1400, b 2400, c 400 (total 4200) → tax 140 / 240 / 40.
		expect(shares(r)).toEqual({ a: 1540, b: 2640, c: 440 });
	});

	it('never loses cents with awkward proportions', () => {
		const r = computeSplit(1001 + 333 + 7, {
			mode: 'itemized',
			items: [
				{ name: 'x', cents: 1001, memberIds: ['a', 'b', 'c'] },
				{ name: 'y', cents: 333, memberIds: ['c'] }
			],
			taxCents: 5,
			tipCents: 2
		});
		expect(total(r)).toBe(1341);
	});

	it('validates the total and item assignments', () => {
		const items = [{ name: 'Pizza', cents: 1000, memberIds: ['a'] }];
		expect(computeSplit(1500, { mode: 'itemized', items, taxCents: 0, tipCents: 0 })).toMatchObject(
			{
				code: 'itemized_mismatch',
				diff: 500
			}
		);
		expect(
			computeSplit(1000, {
				mode: 'itemized',
				items: [{ name: 'Pizza', cents: 1000, memberIds: [] }],
				taxCents: 0,
				tipCents: 0
			})
		).toMatchObject({ code: 'item_without_members' });
	});
});

describe('payers', () => {
	it('supports multiple payers summing to the total', () => {
		const r = validatePayers(5000, [
			{ memberId: 'marco', cents: 3000 },
			{ memberId: 'giulia', cents: 2000 }
		]);
		expect(r.ok).toBe(true);
	});

	it('reports mismatches', () => {
		const r = validatePayers(5000, [{ memberId: 'marco', cents: 3000 }]);
		expect(r).toMatchObject({ ok: false, diff: 2000 });
		expect(validatePayers(5000, [])).toMatchObject({ ok: false });
	});
});
