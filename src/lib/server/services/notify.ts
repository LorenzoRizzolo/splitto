import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { users, type NotificationEvent } from '../db/schema';
import { sendPush, type PushPayload } from '../push';

/**
 * Notifies users about an event, honouring their preferences (all events are on by default).
 * Fire-and-forget: failures are logged, never thrown to the caller.
 */
export function notify(
	userIds: (string | null | undefined)[],
	event: NotificationEvent,
	payload: PushPayload
) {
	const ids = [...new Set(userIds.filter((id): id is string => !!id))];
	if (ids.length === 0) return;
	const recipients = db
		.select({ id: users.id, prefs: users.notifyPrefs })
		.from(users)
		.where(inArray(users.id, ids))
		.all()
		.filter((u) => u.prefs[event] !== false)
		.map((u) => u.id);
	sendPush(recipients, { tag: event, ...payload }).catch((err) => console.error('[notify]', err));
}
