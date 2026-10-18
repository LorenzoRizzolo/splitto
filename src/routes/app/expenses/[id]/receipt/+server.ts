import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getExpenseForUser } from '$lib/server/services/expenses';
import { readUpload } from '$lib/server/uploads';

// Receipts are private: served only to members of the expense's group.
export const GET: RequestHandler = async ({ locals, params }) => {
	const { expense } = getExpenseForUser(locals.user!.id, params.id);
	if (!expense.receiptPath) error(404, 'Nessuno scontrino');
	const file = await readUpload(expense.receiptPath);
	if (!file) error(404, 'Scontrino non trovato');
	return new Response(new Uint8Array(file.data), {
		headers: {
			'Content-Type': file.mime,
			'Cache-Control': 'private, max-age=3600',
			'Content-Disposition': 'inline',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
