import { describe, expect, it } from 'vitest';
import { allocate, centsToInput, formatMoney, parseAmount, splitEvenly, sum } from './money';

describe('parseAmount', () => {
	it.each([
		['12', 1200],
		['12,5', 1250],
		['12,50', 1250],
		['12.50', 1250],
		['0,01', 1],
		[',5', 50],
		['1.234', 123400],
		['1.234,56', 123456],
		['1,234.56', 123456],
		['1.234.567', 123456700],
		['€ 7', 700],
		['  3,10 ', 310],
		['+4', 400]
	])('parses %j as %i cents', (input, cents) => {
		expect(parseAmount(input)).toBe(cents);
	});

	it.each(['', 'abc', '-5', '1,234,5', '12,345,6', '1.2.3', '12,999', '1e3', '12,,5', '1.23,4.5'])(
		'rejects %j',
		(input) => {
			expect(parseAmount(input)).toBeNull();
		}
	);
});

describe('allocate', () => {
	it('distributes leftover cents deterministically to the first recipients', () => {
		expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
		expect(splitEvenly(1001, 3)).toEqual([334, 334, 333]);
		expect(splitEvenly(2, 3)).toEqual([1, 1, 0]);
	});

	it('always sums exactly to the total', () => {
		for (let total = 0; total < 500; total += 7) {
			for (let n = 1; n <= 9; n++) {
				expect(sum(splitEvenly(total, n))).toBe(total);
			}
		}
		const weights = [3, 7, 11, 13, 0, 1];
		for (let total = 0; total < 2000; total += 37)
			expect(sum(allocate(total, weights))).toBe(total);
	});

	it('gives leftovers to the largest remainders first', () => {
		// 100 * [1,2] / 3 = 33.33, 66.67 → the second gets the extra cent.
		expect(allocate(100, [1, 2])).toEqual([33, 67]);
	});

	it('never assigns cents to zero weights', () => {
		expect(allocate(101, [0, 1, 0, 1])).toEqual([0, 51, 0, 50]);
	});

	it('handles negative totals symmetrically', () => {
		expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
	});

	it('handles very large amounts without floating point errors', () => {
		const total = 9_999_999_999_99;
		const parts = allocate(total, [333_333, 333_333, 333_334]);
		expect(sum(parts)).toBe(total);
	});

	it('rejects invalid input', () => {
		expect(() => allocate(10.5, [1])).toThrow();
		expect(() => allocate(10, [])).toThrow();
		expect(() => allocate(10, [0, 0])).toThrow();
		expect(() => allocate(10, [-1, 2])).toThrow();
		expect(allocate(0, [])).toEqual([]);
	});
});

describe('formatting', () => {
	it('formats euro amounts in Italian', () => {
		expect(formatMoney(1250)).toBe('12,50\u00a0€');
		expect(formatMoney(1234567)).toBe('12.345,67\u00a0€');
	});

	it('formats inputs', () => {
		expect(centsToInput(1250)).toBe('12,50');
		expect(centsToInput(5)).toBe('0,05');
		expect(centsToInput(-120)).toBe('-1,20');
	});
});
