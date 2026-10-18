import type { Cents } from './money';
import {
	computeSplit,
	validatePayers,
	type MemberId,
	type ShareRow,
	type SplitInput
} from './split';

export type MaterializedExpense = { payers: ShareRow[]; shares: ShareRow[] };

/** Validates an expense (payers + split) and computes the rows to persist. */
export function materializeExpense(args: {
	amountCents: Cents;
	payers: { memberId: MemberId; cents: Cents }[];
	split: SplitInput;
}):
	| { ok: true; value: MaterializedExpense }
	| { ok: false; field: 'payers' | 'split'; message: string } {
	const payers = validatePayers(args.amountCents, args.payers);
	if (!payers.ok) return { ok: false, field: 'payers', message: payers.message };
	const split = computeSplit(args.amountCents, args.split);
	if (!split.ok) return { ok: false, field: 'split', message: split.message };
	return { ok: true, value: { payers: payers.payers, shares: split.shares } };
}

/** Member ids referenced by a split input (used to verify they belong to the group). */
export function splitMemberIds(split: SplitInput): MemberId[] {
	switch (split.mode) {
		case 'equal':
		case 'adjust':
			return split.members;
		case 'exact':
			return split.amounts.map((a) => a.memberId);
		case 'percent':
			return split.percents.map((p) => p.memberId);
		case 'shares':
			return split.shares.map((s) => s.memberId);
		case 'itemized':
			return [...new Set(split.items.flatMap((i) => i.memberIds))];
	}
}
