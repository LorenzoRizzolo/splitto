import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { config } from '../config';

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | undefined;

export function pushEnabled(): boolean {
	if (configured === undefined) {
		const { publicKey, privateKey, subject } = config.vapid;
		configured = Boolean(publicKey && privateKey);
		if (configured) webpush.setVapidDetails(subject, publicKey, privateKey);
		else
			console.warn(
				'[push] VAPID keys missing: push notifications disabled (npm run vapid:generate)'
			);
	}
	return configured;
}

/** Sends a push to every device of the given users. Expired subscriptions are removed. */
export async function sendPush(userIds: string[], payload: PushPayload) {
	if (userIds.length === 0 || !pushEnabled()) return;
	const subs = db
		.select()
		.from(pushSubscriptions)
		.where(inArray(pushSubscriptions.userId, userIds))
		.all();
	const body = JSON.stringify(payload);
	await Promise.all(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					body,
					{ TTL: 60 * 60 * 24, urgency: 'normal', topic: payload.tag?.slice(0, 32) }
				);
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 404 || status === 410) {
					db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).run();
				} else {
					console.error('[push] send failed', status ?? err);
				}
			}
		})
	);
}
