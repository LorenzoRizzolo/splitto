import { fail, redirect } from '@sveltejs/kit';
import { parseExpenseForm } from './expense-form';
import { ExpenseValidationError, createExpense, updateExpense } from './services/expenses';
import { createRecurring } from './services/recurring';
import { listMembers, type Actor } from './services/groups';
import { deleteUpload, fileField, saveUpload, UploadError } from './uploads';
import type { Expense } from './db/schema';

/** Shared handler for the create/edit expense forms. */
export async function handleExpenseForm(actor: Actor, data: FormData, existing?: Expense) {
	const memberOrder = listMembers(actor.group.id).map((m) => m.id);
	const parsed = parseExpenseForm(data, memberOrder);
	if (!parsed.ok) return fail(400, { errors: parsed.errors });

	let receiptPath: string | null | undefined = undefined;
	const file = fileField(data, 'receipt');
	if (file) {
		try {
			receiptPath = await saveUpload(file, 'receipts');
		} catch (err) {
			if (err instanceof UploadError) return fail(400, { errors: { receipt: err.message } });
			throw err;
		}
	} else if (existing && data.get('remove_receipt') === 'on') {
		receiptPath = null;
	}

	try {
		if (existing) {
			updateExpense(actor, existing, parsed.input, receiptPath);
			if (receiptPath !== undefined && existing.receiptPath)
				await deleteUpload(existing.receiptPath);
			redirect(303, `/app/expenses/${existing.id}`);
		}
		const id = createExpense(actor, parsed.input, receiptPath ?? null);
		if (parsed.repeat) createRecurring(actor, parsed.input, parsed.repeat);
		redirect(303, `/app/groups/${actor.group.id}?added=${id}`);
	} catch (err) {
		if (err instanceof ExpenseValidationError) {
			if (receiptPath) await deleteUpload(receiptPath);
			return fail(400, { errors: { [err.field]: err.message } });
		}
		throw err;
	}
}
