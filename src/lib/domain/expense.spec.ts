import { describe, expect, it } from 'vitest';
import { materializeExpense, splitMemberIds } from './expense';

describe('materializeExpense', () => {
	it('returns payer and share rows for a valid expense', () => {
		const r = materializeExpense({
			amountCents: 1000,
			payers: [{ memberId: 'a', cents: 1000 }],
			split: { mode: 'equal', members: ['a', 'b', 'c'] }
		});
		expect(r).toEqual({
			ok: true,
			value: {
				payers: [{ memberId: 'a', cents: 1000 }],
				shares: [
					{ memberId: 'a', cents: 334 },
					{ memberId: 'b', cents: 333 },
					{ memberId: 'c', cents: 333 }
				]
			}
		});
	});

	it('reports which part is invalid', () => {
		expect(
			materializeExpense({ amountCents: 100, payers: [], split: { mode: 'equal', members: ['a'] } })
		).toMatchObject({ ok: false, field: 'payers' });
		expect(
			materializeExpense({
				amountCents: 100,
				payers: [{ memberId: 'a', cents: 100 }],
				split: { mode: 'equal', members: [] }
			})
		).toMatchObject({ ok: false, field: 'split' });
	});

	it('lists the members referenced by a split', () => {
		expect(
			splitMemberIds({
				mode: 'itemized',
				items: [
					{ name: 'x', cents: 1, memberIds: ['a', 'b'] },
					{ name: 'y', cents: 1, memberIds: ['b', 'c'] }
				],
				taxCents: 0,
				tipCents: 0
			})
		).toEqual(['a', 'b', 'c']);
	});
});
