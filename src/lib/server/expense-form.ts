import { z } from 'zod';
import { parseAmount } from '$lib/domain/money';
import { parsePercent, SPLIT_MODES, type SplitInput } from '$lib/domain/split';
import { CATEGORIES, suggestCategory } from '$lib/domain/categories';
import { isValidISODate } from '$lib/domain/dates';
import type { ExpenseInput } from './services/expenses';
import type { FieldErrors } from './forms';

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;

export type ParsedExpenseForm =
	| { ok: true; input: ExpenseInput; repeat: (typeof FREQUENCIES)[number] | null }
	| { ok: false; errors: FieldErrors };

const itemsSchema = z
	.array(
		z.object({
			name: z.string().trim().max(80).default(''),
			amount: z.string().max(20),
			memberIds: z.array(z.string().max(64)).max(100)
		})
	)
	.max(100);

function signedCents(raw: string): number | null {
	const s = raw.trim();
	if (s === '' || s === '-' || s === '+') return 0;
	const negative = s.startsWith('-');
	const cents = parseAmount(negative ? s.slice(1) : s);
	return cents === null ? null : negative ? -cents : cents;
}

/**
 * Parses the expense form. The same field names are produced with or without JavaScript:
 * `participant` (repeated), `paid_<memberId>`, `exact_<id>`, `percent_<id>`, `shares_<id>`,
 * `adjust_<id>`, `items_json`, `tax`, `tip`.
 * `memberOrder` is the group member order, used to keep splits deterministic.
 */
export function parseExpenseForm(data: FormData, memberOrder: string[]): ParsedExpenseForm {
	const errors: FieldErrors = {};
	const str = (k: string) => {
		const v = data.get(k);
		return typeof v === 'string' ? v : '';
	};

	const description = str('description').trim();
	if (!description) errors.description = 'Scrivi una descrizione';
	else if (description.length > 100) errors.description = 'Massimo 100 caratteri';

	const amountCents = parseAmount(str('amount'));
	if (amountCents === null) errors.amount = 'Importo non valido (es. 12,50)';
	else if (amountCents === 0) errors.amount = "L'importo deve essere maggiore di zero";

	const date = str('date');
	if (!isValidISODate(date)) errors.date = 'Data non valida';

	const rawCategory = str('category');
	const category = (CATEGORIES as readonly string[]).includes(rawCategory)
		? (rawCategory as ExpenseInput['category'])
		: (suggestCategory(description) ?? 'other');

	const notes = str('notes').trim().slice(0, 1000) || null;

	const total = amountCents ?? 0;

	// --- Payers ---
	let payers: { memberId: string; cents: number }[] = [];
	if (str('payer_mode') === 'multi') {
		for (const id of memberOrder) {
			const raw = str(`paid_${id}`);
			if (!raw.trim()) continue;
			const cents = parseAmount(raw);
			if (cents === null) errors.payers = 'Importo pagato non valido';
			else if (cents > 0) payers.push({ memberId: id, cents });
		}
	} else {
		const payer = str('payer');
		if (!memberOrder.includes(payer)) errors.payers = 'Indica chi ha pagato';
		else payers = [{ memberId: payer, cents: total }];
	}

	// --- Split ---
	const mode = str('split_mode') || 'equal';
	let split: SplitInput | null = null;
	const participants = data.getAll('participant').filter((v): v is string => typeof v === 'string');
	const selected = memberOrder.filter((id) => participants.includes(id));

	switch (mode as (typeof SPLIT_MODES)[number]) {
		case 'equal':
			split = { mode: 'equal', members: selected };
			break;
		case 'exact': {
			const amounts = [];
			for (const id of memberOrder) {
				const raw = str(`exact_${id}`);
				if (!raw.trim()) continue;
				const cents = parseAmount(raw);
				if (cents === null) errors.split = 'Uno degli importi non è valido';
				else amounts.push({ memberId: id, cents });
			}
			split = { mode: 'exact', amounts };
			break;
		}
		case 'percent': {
			const percents = [];
			for (const id of memberOrder) {
				const raw = str(`percent_${id}`);
				if (!raw.trim()) continue;
				const bp = parsePercent(raw);
				if (bp === null) errors.split = 'Una delle percentuali non è valida';
				else percents.push({ memberId: id, basisPoints: bp });
			}
			split = { mode: 'percent', percents };
			break;
		}
		case 'shares': {
			const shares = [];
			for (const id of memberOrder) {
				const raw = str(`shares_${id}`).trim().replace(',', '.');
				if (!raw) continue;
				const n = Number(raw);
				if (!Number.isFinite(n) || n < 0) errors.split = 'Una delle quote non è valida';
				else shares.push({ memberId: id, shares: n });
			}
			split = { mode: 'shares', shares };
			break;
		}
		case 'adjust': {
			const adjustments = [];
			for (const id of selected) {
				const cents = signedCents(str(`adjust_${id}`));
				if (cents === null) errors.split = 'Uno degli aggiustamenti non è valido';
				else if (cents !== 0) adjustments.push({ memberId: id, cents });
			}
			split = { mode: 'adjust', members: selected, adjustments };
			break;
		}
		case 'itemized': {
			let parsed: z.infer<typeof itemsSchema> = [];
			try {
				const r = itemsSchema.safeParse(JSON.parse(str('items_json') || '[]'));
				if (r.success) parsed = r.data;
				else errors.split = 'Voci dello scontrino non valide';
			} catch {
				errors.split = 'Voci dello scontrino non valide';
			}
			const items = [];
			for (const item of parsed) {
				const cents = parseAmount(item.amount);
				if (cents === null) {
					errors.split = `Importo non valido per “${item.name || 'voce'}”`;
					continue;
				}
				items.push({
					name: item.name,
					cents,
					memberIds: memberOrder.filter((id) => item.memberIds.includes(id))
				});
			}
			const tax = parseAmount(str('tax') || '0');
			const tip = parseAmount(str('tip') || '0');
			if (tax === null || tip === null) errors.split = 'Tasse o mancia non valide';
			split = { mode: 'itemized', items, taxCents: tax ?? 0, tipCents: tip ?? 0 };
			break;
		}
		default:
			errors.split = 'Modalità di divisione non valida';
	}

	const repeatRaw = str('repeat');
	const repeat = (FREQUENCIES as readonly string[]).includes(repeatRaw)
		? (repeatRaw as (typeof FREQUENCIES)[number])
		: null;

	if (Object.keys(errors).length > 0 || !split || amountCents === null)
		return { ok: false, errors };
	return {
		ok: true,
		input: { description, amountCents, date, category, notes, payers, split },
		repeat
	};
}
