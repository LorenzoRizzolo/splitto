import { runDueRecurring } from '../services/recurring';

export async function runRecurringExpenses() {
	const n = runDueRecurring();
	if (n > 0) console.info(`[jobs] generated ${n} recurring expense(s)`);
}
