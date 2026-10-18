import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db';
import { newId } from '../db/id';
import { groups, recurringExpenses, type Group } from '../db/schema';
import { nextOccurrence, todayISO, type Frequency } from '$lib/domain/dates';
import { formatMoney } from '$lib/domain/money';
import { insertExpense, ExpenseValidationError, checkBudget, type ExpenseInput } from './expenses';
import { notify } from './notify';
import type { Actor } from './groups';

export const FREQUENCY_LABELS: Record<Frequency, string> = {
	weekly: 'Ogni settimana',
	monthly: 'Ogni mese',
	yearly: 'Ogni anno'
};

type Template = Omit<ExpenseInput, 'date'> & { anchorDay: number };

/** Schedules the next occurrences of an expense that was just created on `input.date`. */
export function createRecurring(actor: Actor, input: ExpenseInput, frequency: Frequency): string {
	const anchorDay = Number(input.date.slice(8, 10));
	const { date: _date, ...rest } = input;
	const template: Template = { ...rest, anchorDay };
	const id = newId();
	db.insert(recurringExpenses)
		.values({
			id,
			groupId: actor.group.id,
			frequency,
			nextRunOn: nextOccurrence(input.date, frequency, anchorDay),
			template,
			createdBy: actor.userId
		})
		.run();
	return id;
}

export function listRecurring(groupId: string) {
	return db
		.select()
		.from(recurringExpenses)
		.where(eq(recurringExpenses.groupId, groupId))
		.all()
		.map((r) => ({ ...r, template: r.template as unknown as Template }));
}

export function setRecurringActive(actor: Actor, id: string, active: boolean) {
	db.update(recurringExpenses)
		.set({ active })
		.where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.groupId, actor.group.id)))
		.run();
}

export function deleteRecurring(actor: Actor, id: string) {
	db.delete(recurringExpenses)
		.where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.groupId, actor.group.id)))
		.run();
}

/**
 * Generates every due occurrence (catching up if the server was down). Idempotent: each
 * occurrence advances `next_run_on` in the same transaction that inserts the expense.
 */
export function runDueRecurring(today = todayISO()): number {
	let generated = 0;
	const due = db
		.select({ r: recurringExpenses, group: groups })
		.from(recurringExpenses)
		.innerJoin(groups, eq(groups.id, recurringExpenses.groupId))
		.where(and(eq(recurringExpenses.active, true), lte(recurringExpenses.nextRunOn, today)))
		.all();

	for (const { r, group } of due) {
		const template = r.template as unknown as Template;
		let next = r.nextRunOn;
		// Safety cap: never generate more than 60 occurrences in one run.
		for (let i = 0; i < 60 && next <= today; i++) {
			if (group.archivedAt) break;
			const date = next;
			const following = nextOccurrence(date, r.frequency, template.anchorDay);
			try {
				const { id, involvedUserIds } = db.transaction((tx) => {
					const res = insertExpense(tx, {
						groupId: group.id,
						actorUserId: null,
						recurringId: r.id,
						input: { ...template, date }
					});
					tx.update(recurringExpenses)
						.set({ nextRunOn: following, lastRunAt: new Date() })
						.where(eq(recurringExpenses.id, r.id))
						.run();
					return res;
				});
				generated++;
				notifyGenerated(group, template, id, involvedUserIds);
			} catch (err) {
				if (err instanceof ExpenseValidationError) {
					// e.g. a member left the group: pause instead of failing forever.
					db.update(recurringExpenses)
						.set({ active: false })
						.where(eq(recurringExpenses.id, r.id))
						.run();
					console.warn(`[recurring] paused ${r.id}: ${err.message}`);
					break;
				}
				throw err;
			}
			next = following;
		}
		checkBudget(group.id);
	}
	return generated;
}

function notifyGenerated(group: Group, template: Template, expenseId: string, userIds: string[]) {
	notify(userIds, 'recurring_generated', {
		title: `🔁 ${template.description}`,
		body: `Spesa ricorrente aggiunta: ${formatMoney(template.amountCents)}${group.kind === 'group' ? ` in ${group.name}` : ''}`,
		url: `/app/expenses/${expenseId}`
	});
}
