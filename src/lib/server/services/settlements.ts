import { error } from '@sveltejs/kit';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { db } from '../db';
import { newId } from '../db/id';
import {
	groupMembers,
	paymentReminders,
	settlements,
	type Settlement,
	type SettlementMethod
} from '../db/schema';
import { formatMoney } from '$lib/domain/money';
import { logActivity } from './activity';
import { notify } from './notify';
import { getGroupMember, listMembers, requireNotArchived, type Actor } from './groups';
import { groupBalances } from './balances';
import { balanceBetween } from '$lib/domain/balances';

export const METHOD_LABELS: Record<SettlementMethod, string> = {
	cash: 'Contanti',
	bank: 'Bonifico',
	paypal: 'PayPal',
	satispay: 'Satispay',
	other: 'Altro'
};

export type SettlementInput = {
	fromMemberId: string;
	toMemberId: string;
	amountCents: number;
	method: SettlementMethod;
	date: string;
	note: string | null;
};

export function createSettlement(
	actor: Actor,
	input: SettlementInput
): { id: string; groupSettled: boolean } {
	requireNotArchived(actor);
	if (input.fromMemberId === input.toMemberId)
		error(400, 'Chi paga e chi riceve devono essere persone diverse');
	if (input.amountCents <= 0) error(400, "L'importo deve essere maggiore di zero");
	const from = getGroupMember(actor.group.id, input.fromMemberId);
	const to = getGroupMember(actor.group.id, input.toMemberId);
	const names = new Map(listMembers(actor.group.id).map((m) => [m.id, m.name]));

	const id = newId();
	db.transaction((tx) => {
		tx.insert(settlements)
			.values({ id, groupId: actor.group.id, createdBy: actor.userId, ...input })
			.run();
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: 'settlement_created',
			entityId: id,
			data: {
				amountCents: input.amountCents,
				from: names.get(from.id),
				to: names.get(to.id),
				method: input.method
			}
		});
	});
	notify(
		[to.userId, from.userId].filter((u) => u !== actor.userId),
		'settlement_received',
		{
			title: `💸 Rimborso di ${formatMoney(input.amountCents)}`,
			body: `${names.get(from.id)} → ${names.get(to.id)} (${METHOD_LABELS[input.method]})`,
			url: `/app/groups/${actor.group.id}/balances`
		}
	);
	return { id, groupSettled: groupBalances(actor.group).settled };
}

export function getSettlement(groupId: string, settlementId: string): Settlement {
	const s = db
		.select()
		.from(settlements)
		.where(and(eq(settlements.id, settlementId), eq(settlements.groupId, groupId)))
		.get();
	if (!s) error(404, 'Rimborso non trovato');
	return s;
}

export function deleteSettlement(actor: Actor, s: Settlement) {
	requireNotArchived(actor);
	if (s.createdBy !== actor.userId && actor.member.role !== 'admin') {
		error(403, 'Puoi eliminare solo i rimborsi che hai registrato tu');
	}
	db.transaction((tx) => {
		tx.update(settlements).set({ deletedAt: new Date() }).where(eq(settlements.id, s.id)).run();
		logActivity(tx, {
			groupId: s.groupId,
			actorUserId: actor.userId,
			type: 'settlement_deleted',
			entityId: s.id,
			data: { amountCents: s.amountCents }
		});
	});
}

export function listSettlements(groupId: string, limit = 200) {
	return db
		.select()
		.from(settlements)
		.where(and(eq(settlements.groupId, groupId), isNull(settlements.deletedAt)))
		.orderBy(desc(settlements.date), desc(settlements.createdAt))
		.limit(limit)
		.all();
}

// --- Payment reminders ------------------------------------------------------------------------

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function lastReminderAt(fromUserId: string, toMemberId: string): Date | null {
	return (
		db
			.select({ at: paymentReminders.createdAt })
			.from(paymentReminders)
			.where(
				and(
					eq(paymentReminders.fromUserId, fromUserId),
					eq(paymentReminders.toMemberId, toMemberId)
				)
			)
			.orderBy(desc(paymentReminders.createdAt))
			.limit(1)
			.get()?.at ?? null
	);
}

export function sendReminder(
	actor: Actor,
	toMemberId: string
): { ok: true } | { ok: false; message: string } {
	const target = getGroupMember(actor.group.id, toMemberId);
	if (!target.userId)
		return {
			ok: false,
			message: 'Questa persona non ha ancora un account: mandale il link di invito'
		};
	const balances = groupBalances(actor.group);
	const owed = balanceBetween(balances.debts, actor.member.id, target.id);
	if (owed <= 0) return { ok: false, message: 'Questa persona non ti deve nulla' };

	const recent = db
		.select({ id: paymentReminders.id })
		.from(paymentReminders)
		.where(
			and(
				eq(paymentReminders.fromUserId, actor.userId),
				eq(paymentReminders.toMemberId, toMemberId),
				gte(paymentReminders.createdAt, new Date(Date.now() - REMINDER_INTERVAL_MS))
			)
		)
		.get();
	if (recent) return { ok: false, message: 'Hai già inviato un promemoria nelle ultime 24 ore' };

	db.insert(paymentReminders)
		.values({ id: newId(), groupId: actor.group.id, fromUserId: actor.userId, toMemberId })
		.run();
	const me = listMembers(actor.group.id).find((m) => m.id === actor.member.id);
	notify([target.userId], 'payment_reminder', {
		title: '⏰ Promemoria di pagamento',
		body: `${me?.name ?? 'Un amico'} ti ricorda che gli devi ${formatMoney(owed)}${actor.group.kind === 'group' ? ` (${actor.group.name})` : ''}`,
		url: `/app/groups/${actor.group.id}/balances`
	});
	return { ok: true };
}

export function canRemind(fromUserId: string, toMemberId: string): boolean {
	const at = lastReminderAt(fromUserId, toMemberId);
	return !at || Date.now() - at.getTime() >= REMINDER_INTERVAL_MS;
}

export function activeMemberIds(groupId: string): string[] {
	return db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)))
		.all()
		.map((r) => r.id);
}
