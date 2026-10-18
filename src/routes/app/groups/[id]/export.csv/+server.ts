import type { RequestHandler } from './$types';
import { groupTitle, listMembers, requireMembership } from '$lib/server/services/groups';
import { getExpenseDetail, listExpenses } from '$lib/server/services/expenses';
import { CATEGORY_INFO } from '$lib/domain/categories';
import { centsToInput } from '$lib/domain/money';

// Italian Excel conventions: ";" separator, decimal comma, UTF-8 BOM.
function cell(v: string): string {
	const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // prevent CSV formula injection
	return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET: RequestHandler = ({ locals, params }) => {
	const actor = requireMembership(locals.user!.id, params.id);
	const members = listMembers(actor.group.id);
	const expenses = listExpenses(actor.group.id, actor.member.id).reverse();
	const header = [
		'Data',
		'Descrizione',
		'Categoria',
		'Importo (EUR)',
		'Pagato da',
		...members.map((m) => `Quota ${m.name}`),
		'Note'
	];
	const lines = [header.map(cell).join(';')];
	for (const e of expenses) {
		const d = getExpenseDetail(e.id);
		const paidBy = d.payers
			.map(
				(p) =>
					`${members.find((m) => m.id === p.memberId)?.name ?? '?'} ${centsToInput(p.amountCents)}`
			)
			.join(', ');
		const row = [
			e.date,
			e.description,
			CATEGORY_INFO[e.category].label,
			centsToInput(e.amountCents),
			paidBy,
			...members.map((m) => {
				const s = d.shares.find((x) => x.memberId === m.id);
				return s ? centsToInput(s.amountCents) : '';
			}),
			e.notes ?? ''
		];
		lines.push(row.map(cell).join(';'));
	}
	const filename = `splitto-${
		groupTitle(actor.group, actor.userId)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'gruppo'
	}.csv`;
	return new Response('\uFEFF' + lines.join('\r\n'), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
