import { config } from '../config';
import { deleteExpiredSessions } from '../auth/session';
import { runRecurringExpenses } from './recurring';

let started = false;
const MINUTE = 60_000;

/** Starts in-process background jobs (once per process). */
export function startJobs() {
	if (started || !config.jobsEnabled) return;
	started = true;

	const safe = (name: string, fn: () => unknown) => async () => {
		try {
			await fn();
		} catch (err) {
			console.error(`[jobs] ${name} failed`, err);
		}
	};

	const recurring = safe('recurring', runRecurringExpenses);
	const cleanup = safe('cleanup', deleteExpiredSessions);
	setTimeout(recurring, 5_000).unref();
	setInterval(recurring, 15 * MINUTE).unref();
	setInterval(cleanup, 60 * MINUTE).unref();
}
