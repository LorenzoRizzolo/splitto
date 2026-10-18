import { formatMoney } from './money';

export type NamedDebt = { from: string; to: string; cents: number };

/** "Giulia deve 12,50 € a Marco" — "Devi"/"ti deve" when the viewer is involved. */
export function debtSentence(d: NamedDebt, me?: string): string {
	const amount = formatMoney(d.cents);
	if (me && d.from === me) return `Devi ${amount} a ${d.to}`;
	if (me && d.to === me) return `${d.from} ti deve ${amount}`;
	return `${d.from} deve ${amount} a ${d.to}`;
}

/** Plain-text summary ready to paste in WhatsApp. */
export function shareSummary(
	title: string,
	debts: NamedDebt[],
	totalSpent: number,
	url?: string
): string {
	const lines = [
		`💰 *${title}* — riepilogo Splitto`,
		`Spesa totale: ${formatMoney(totalSpent)}`,
		''
	];
	if (debts.length === 0) lines.push('Siete pari! 🎉');
	else for (const d of debts) lines.push(`• ${debtSentence(d)}`);
	if (url) lines.push('', url);
	return lines.join('\n');
}
