import { allocate, formatMoney, splitEvenly, sum, type Cents } from './money';

// Pure split computation shared by the client (live validation) and the server (source of truth).
// Member order is significant: when a split is not exact, leftover cents go to earlier members.

export type MemberId = string;

export type SplitInput =
	| { mode: 'equal'; members: MemberId[] }
	| { mode: 'exact'; amounts: { memberId: MemberId; cents: Cents }[] }
	/** basisPoints: 1% = 100, total must be 10_000. */
	| { mode: 'percent'; percents: { memberId: MemberId; basisPoints: number }[] }
	/** shares are positive numbers with up to 2 decimals (e.g. 2, 1, 0.5). */
	| { mode: 'shares'; shares: { memberId: MemberId; shares: number }[] }
	/** Equal split among members, then +/- a per-member adjustment in cents. */
	| { mode: 'adjust'; members: MemberId[]; adjustments: { memberId: MemberId; cents: Cents }[] }
	| {
			mode: 'itemized';
			items: { name: string; cents: Cents; memberIds: MemberId[] }[];
			/** Tax and tip are distributed proportionally to each member's items subtotal. */
			taxCents: Cents;
			tipCents: Cents;
	  };

export const SPLIT_MODES = ['equal', 'exact', 'percent', 'shares', 'adjust', 'itemized'] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export type ShareRow = { memberId: MemberId; cents: Cents };

export type SplitErrorCode =
	| 'no_members'
	| 'duplicate_member'
	| 'invalid_value'
	| 'exact_mismatch'
	| 'percent_mismatch'
	| 'adjust_overflow'
	| 'negative_share'
	| 'itemized_mismatch'
	| 'item_without_members';

export type SplitResult =
	| { ok: true; shares: ShareRow[] }
	| {
			ok: false;
			code: SplitErrorCode;
			message: string;
			/** total minus entered (cents or bp) */ diff?: number;
	  };

const fail = (code: SplitErrorCode, message: string, diff?: number): SplitResult => ({
	ok: false,
	code,
	message,
	diff
});

/** Human message for a missing/excess amount: "Mancano 2,50 €" / "Avanzano 1,00 €". */
export function describeDiff(diffCents: Cents): string {
	if (diffCents > 0) return `Mancano ${formatMoney(diffCents)}`;
	if (diffCents < 0) return `Avanzano ${formatMoney(-diffCents)}`;
	return 'Il totale torna';
}

function hasDuplicates(ids: MemberId[]): boolean {
	return new Set(ids).size !== ids.length;
}

export function computeSplit(totalCents: Cents, input: SplitInput): SplitResult {
	if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
		return fail('invalid_value', "L'importo non è valido");
	}

	switch (input.mode) {
		case 'equal': {
			if (input.members.length === 0) return fail('no_members', 'Seleziona almeno una persona');
			if (hasDuplicates(input.members)) return fail('duplicate_member', 'Persona ripetuta');
			const parts = splitEvenly(totalCents, input.members.length);
			return {
				ok: true,
				shares: input.members.map((memberId, i) => ({ memberId, cents: parts[i]! }))
			};
		}

		case 'exact': {
			if (input.amounts.length === 0) return fail('no_members', 'Inserisci almeno un importo');
			if (hasDuplicates(input.amounts.map((a) => a.memberId)))
				return fail('duplicate_member', 'Persona ripetuta');
			if (input.amounts.some((a) => !Number.isSafeInteger(a.cents) || a.cents < 0)) {
				return fail('invalid_value', 'Gli importi devono essere positivi');
			}
			const diff = totalCents - sum(input.amounts.map((a) => a.cents));
			if (diff !== 0) return fail('exact_mismatch', describeDiff(diff), diff);
			return nonZero(input.amounts.map((a) => ({ memberId: a.memberId, cents: a.cents })));
		}

		case 'percent': {
			const rows = input.percents;
			if (rows.length === 0) return fail('no_members', 'Inserisci almeno una percentuale');
			if (hasDuplicates(rows.map((r) => r.memberId)))
				return fail('duplicate_member', 'Persona ripetuta');
			if (rows.some((r) => !Number.isSafeInteger(r.basisPoints) || r.basisPoints < 0)) {
				return fail('invalid_value', 'Percentuali non valide (massimo 2 decimali)');
			}
			const diff = 10_000 - sum(rows.map((r) => r.basisPoints));
			if (diff !== 0) {
				const pct = (Math.abs(diff) / 100).toLocaleString('it-IT');
				return fail('percent_mismatch', diff > 0 ? `Manca il ${pct}%` : `Avanza il ${pct}%`, diff);
			}
			const parts = allocate(
				totalCents,
				rows.map((r) => r.basisPoints)
			);
			return nonZero(rows.map((r, i) => ({ memberId: r.memberId, cents: parts[i]! })));
		}

		case 'shares': {
			const rows = input.shares;
			if (hasDuplicates(rows.map((r) => r.memberId)))
				return fail('duplicate_member', 'Persona ripetuta');
			const weights = rows.map((r) => Math.round(r.shares * 100));
			if (
				rows.some(
					(r, i) =>
						!Number.isFinite(r.shares) ||
						r.shares < 0 ||
						Math.abs(weights[i]! / 100 - r.shares) > 1e-9
				)
			) {
				return fail('invalid_value', 'Le quote devono essere numeri positivi (massimo 2 decimali)');
			}
			if (sum(weights) === 0) return fail('no_members', 'Assegna almeno una quota');
			const parts = allocate(totalCents, weights);
			return nonZero(rows.map((r, i) => ({ memberId: r.memberId, cents: parts[i]! })));
		}

		case 'adjust': {
			if (input.members.length === 0) return fail('no_members', 'Seleziona almeno una persona');
			if (hasDuplicates(input.members)) return fail('duplicate_member', 'Persona ripetuta');
			if (input.adjustments.some((a) => !Number.isSafeInteger(a.cents))) {
				return fail('invalid_value', 'Aggiustamento non valido');
			}
			const adj = new Map<MemberId, Cents>();
			for (const a of input.adjustments) {
				if (!input.members.includes(a.memberId)) {
					return fail('invalid_value', 'Aggiustamento per una persona non selezionata');
				}
				adj.set(a.memberId, (adj.get(a.memberId) ?? 0) + a.cents);
			}
			const remaining = totalCents - sum([...adj.values()]);
			if (remaining < 0) {
				return fail('adjust_overflow', 'Gli aggiustamenti superano il totale', remaining);
			}
			const parts = splitEvenly(remaining, input.members.length);
			const shares = input.members.map((memberId, i) => ({
				memberId,
				cents: parts[i]! + (adj.get(memberId) ?? 0)
			}));
			if (shares.some((s) => s.cents < 0)) {
				return fail('negative_share', 'Una quota risulterebbe negativa');
			}
			return nonZero(shares);
		}

		case 'itemized': {
			const { items, taxCents, tipCents } = input;
			if (items.length === 0) return fail('no_members', 'Aggiungi almeno una voce');
			if (
				[taxCents, tipCents, ...items.map((i) => i.cents)].some(
					(c) => !Number.isSafeInteger(c) || c < 0
				)
			) {
				return fail('invalid_value', 'Importi delle voci non validi');
			}
			const diff = totalCents - (sum(items.map((i) => i.cents)) + taxCents + tipCents);
			if (diff !== 0) return fail('itemized_mismatch', describeDiff(diff), diff);

			// Keep a stable member order: first appearance across items.
			const order: MemberId[] = [];
			const subtotal = new Map<MemberId, Cents>();
			for (const item of items) {
				if (item.memberIds.length === 0) {
					return fail(
						'item_without_members',
						`Assegna “${item.name || 'voce'}” ad almeno una persona`
					);
				}
				if (hasDuplicates(item.memberIds)) return fail('duplicate_member', 'Persona ripetuta');
				const parts = splitEvenly(item.cents, item.memberIds.length);
				item.memberIds.forEach((id, i) => {
					if (!subtotal.has(id)) order.push(id);
					subtotal.set(id, (subtotal.get(id) ?? 0) + parts[i]!);
				});
			}
			const extra = taxCents + tipCents;
			const subtotals = order.map((id) => subtotal.get(id)!);
			const extras =
				extra === 0
					? order.map(() => 0)
					: sum(subtotals) === 0
						? splitEvenly(extra, order.length)
						: allocate(extra, subtotals);
			return nonZero(order.map((memberId, i) => ({ memberId, cents: subtotals[i]! + extras[i]! })));
		}
	}
}

function nonZero(shares: ShareRow[]): SplitResult {
	const rows = shares.filter((s) => s.cents !== 0);
	// A zero-amount expense still needs at least one participant row to be meaningful.
	return { ok: true, shares: rows.length > 0 ? rows : shares.slice(0, 1) };
}

/** Validates the payers of an expense: positive amounts, no duplicates, summing to the total. */
export function validatePayers(
	totalCents: Cents,
	payers: { memberId: MemberId; cents: Cents }[]
): { ok: true; payers: ShareRow[] } | { ok: false; message: string; diff?: number } {
	const rows = payers.filter((p) => p.cents !== 0);
	if (rows.length === 0) return { ok: false, message: 'Indica chi ha pagato' };
	if (hasDuplicates(rows.map((p) => p.memberId)))
		return { ok: false, message: 'Pagatore ripetuto' };
	if (rows.some((p) => !Number.isSafeInteger(p.cents) || p.cents < 0)) {
		return { ok: false, message: 'Gli importi pagati devono essere positivi' };
	}
	const diff = totalCents - sum(rows.map((p) => p.cents));
	if (diff !== 0)
		return { ok: false, message: `Pagatori: ${describeDiff(diff).toLowerCase()}`, diff };
	return { ok: true, payers: rows };
}

/** Converts a percentage typed by the user ("33,33") into basis points (3333). */
export function parsePercent(input: string): number | null {
	const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim());
	if (!m) return null;
	const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
	return bp <= 10_000 ? bp : null;
}
