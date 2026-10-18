// Money helpers. Splitto works exclusively in euro: every amount is an integer number of
// euro cents. Never use floats for money.

export type Cents = number;

const MAX_CENTS = 100_000_000_00; // 100 million units: a sane upper bound for one expense.

export function assertCents(value: number, label = 'amount'): asserts value is Cents {
	if (!Number.isSafeInteger(value))
		throw new TypeError(`${label} must be an integer number of cents`);
}

/**
 * Parses a user-typed amount ("12,50", "12.5", "1.234,56", "1,234.56", "€ 7") into cents.
 * Returns null when the input is not a valid non-negative amount with at most 2 decimals.
 */
export function parseAmount(input: string): Cents | null {
	let s = input.trim().replace(/[\s\u00a0€$£]/g, '');
	if (s === '' || s.startsWith('-')) return null;
	if (s.startsWith('+')) s = s.slice(1);
	if (!/^[\d.,]+$/.test(s)) return null;

	const lastComma = s.lastIndexOf(',');
	const lastDot = s.lastIndexOf('.');
	let intPart: string;
	let decPart = '';

	if (lastComma >= 0 && lastDot >= 0) {
		// Both present: the right-most one is the decimal separator.
		const decSep = lastComma > lastDot ? ',' : '.';
		const thousandSep = decSep === ',' ? '.' : ',';
		const idx = s.lastIndexOf(decSep);
		intPart = s.slice(0, idx);
		decPart = s.slice(idx + 1);
		if (intPart.includes(decSep)) return null;
		if (!isGroupedInteger(intPart, thousandSep)) return null;
		intPart = intPart.split(thousandSep).join('');
	} else if (lastComma >= 0 || lastDot >= 0) {
		const sep = lastComma >= 0 ? ',' : '.';
		const parts = s.split(sep);
		// A single comma is always decimal (Italian input); a single dot is decimal unless it is
		// followed by exactly 3 digits ("1.234" = one thousand two hundred thirty-four).
		if (parts.length === 2 && (sep === ',' || parts[1]!.length !== 3)) {
			intPart = parts[0]!;
			decPart = parts[1]!;
		} else {
			// "1.234" / "1,234,567": thousands separators.
			if (!isGroupedInteger(s, sep)) return null;
			intPart = parts.join('');
		}
	} else {
		intPart = s;
	}

	if (intPart === '') intPart = '0';
	if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null;
	const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
	if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
	return cents;
}

function isGroupedInteger(s: string, sep: string): boolean {
	const groups = s.split(sep);
	if (groups.length === 1) return /^\d+$/.test(s);
	return /^\d{1,3}$/.test(groups[0]!) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

const euro = new Intl.NumberFormat('it-IT', {
	style: 'currency',
	currency: 'EUR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** Formats cents as euro, e.g. 1250 → "12,50 €". */
export function formatMoney(cents: Cents): string {
	// Normalise narrow no-break spaces so output is stable across ICU versions.
	return euro.format(cents / 100).replace(/\u202f/g, '\u00a0');
}

/** Formats cents as a plain decimal for inputs, e.g. 1250 → "12,50". */
export function centsToInput(cents: Cents): string {
	const sign = cents < 0 ? '-' : '';
	const abs = Math.abs(cents);
	return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Splits `total` cents proportionally to non-negative integer `weights`, using the
 * largest-remainder method. The result always sums exactly to `total`. Leftover cents go to
 * the largest fractional remainders; ties are broken by position (earlier first), so the
 * outcome is fully deterministic.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
	assertCents(total, 'total');
	if (weights.length === 0) {
		if (total === 0) return [];
		throw new RangeError('Cannot allocate a non-zero amount among zero recipients');
	}
	for (const w of weights) {
		if (!Number.isSafeInteger(w) || w < 0)
			throw new RangeError('Weights must be non-negative integers');
	}
	const sumWeights = weights.reduce((a, b) => a + b, 0);
	if (sumWeights === 0) {
		if (total === 0) return weights.map(() => 0);
		throw new RangeError('Cannot allocate a non-zero amount with all-zero weights');
	}

	const sign = total < 0 ? -1n : 1n;
	const absTotal = BigInt(Math.abs(total));
	const bigSum = BigInt(sumWeights);
	const base: bigint[] = [];
	const remainders: { index: number; rem: bigint }[] = [];
	let allocated = 0n;
	weights.forEach((w, index) => {
		const product = absTotal * BigInt(w);
		const q = product / bigSum;
		base.push(q);
		allocated += q;
		remainders.push({ index, rem: product % bigSum });
	});

	let leftover = absTotal - allocated;
	remainders.sort((a, b) => (a.rem === b.rem ? a.index - b.index : a.rem > b.rem ? -1 : 1));
	for (const r of remainders) {
		if (leftover === 0n) break;
		if (weights[r.index] === 0) continue;
		base[r.index]! += 1n;
		leftover -= 1n;
	}
	return base.map((v) => Number(v * sign));
}

/** Equal split of `total` among `n` people; the first ones receive the extra cents. */
export function splitEvenly(total: Cents, n: number): Cents[] {
	return allocate(
		total,
		Array.from({ length: n }, () => 1)
	);
}

export function sum(values: readonly number[]): number {
	return values.reduce((a, b) => a + b, 0);
}
