import { formatMoney } from './money';

export type ActivityLike = {
	type: string;
	actorName: string;
	actorIsMe: boolean;
	groupName: string;
	groupKind: 'group' | 'direct';
	data: Record<string, unknown>;
};

const METHOD: Record<string, string> = {
	cash: 'in contanti',
	bank: 'con bonifico',
	paypal: 'con PayPal',
	satispay: 'con Satispay',
	other: ''
};

/** Italian sentence describing an activity, e.g. "Hai aggiunto “Cena” (90,00 €)". */
export function describeActivity(a: ActivityLike): { text: string; icon: string } {
	const who = a.actorIsMe ? 'Hai' : `${a.actorName} ha`;
	const d = a.data;
	const desc = typeof d.description === 'string' ? `“${d.description}”` : 'una spesa';
	const amount = typeof d.amountCents === 'number' ? ` (${formatMoney(d.amountCents)})` : '';
	const name = typeof d.name === 'string' ? d.name : '';
	switch (a.type) {
		case 'group_created':
			return { icon: '✨', text: `${who} creato il gruppo ${name || a.groupName}` };
		case 'group_updated':
			return {
				icon: '⚙️',
				text: d.unarchived
					? `${who} riattivato il gruppo`
					: `${who} modificato le impostazioni del gruppo`
			};
		case 'group_archived':
			return { icon: '🗄️', text: `${who} archiviato il gruppo` };
		case 'member_added':
			return { icon: '👋', text: `${who} aggiunto ${name}${d.guest ? ' (ospite)' : ''}` };
		case 'member_joined':
			return {
				icon: '🎉',
				text: `${a.actorIsMe ? 'Ti sei unito' : `${a.actorName} si è unito`} al gruppo`
			};
		case 'member_left':
			return {
				icon: '🚪',
				text: `${a.actorIsMe ? 'Sei uscito' : `${name || a.actorName} è uscito`} dal gruppo`
			};
		case 'member_removed':
			return { icon: '🚪', text: `${who} rimosso ${name} dal gruppo` };
		case 'guest_claimed':
			return {
				icon: '🔗',
				text: `${a.actorIsMe ? 'Hai' : `${a.actorName} ha`} rivendicato il profilo ospite “${String(d.guestName ?? '')}”`
			};
		case 'expense_created':
			return { icon: '🧾', text: `${who} aggiunto ${desc}${amount}` };
		case 'expense_updated': {
			const changes =
				Array.isArray(d.changes) && d.changes.length ? `: ${d.changes.join(', ')}` : '';
			return { icon: '✏️', text: `${who} modificato ${desc}${changes}` };
		}
		case 'expense_deleted':
			return { icon: '🗑️', text: `${who} eliminato ${desc}${amount}` };
		case 'expense_restored':
			return { icon: '♻️', text: `${who} ripristinato ${desc}${amount}` };
		case 'settlement_created': {
			const method = METHOD[String(d.method)] ?? '';
			return {
				icon: '💸',
				text: `${who} registrato un rimborso: ${String(d.from ?? '')} → ${String(d.to ?? '')}${amount}${method ? ` ${method}` : ''}`
			};
		}
		case 'settlement_deleted':
			return { icon: '↩️', text: `${who} annullato un rimborso${amount}` };
		case 'comment_added':
			return { icon: '💬', text: `${who} commentato ${desc}` };
		case 'recurring_generated':
			return { icon: '🔁', text: `Spesa ricorrente aggiunta: ${desc}${amount}` };
		default:
			return { icon: '•', text: `${who} fatto una modifica` };
	}
}
