import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import { newId } from '$lib/server/db/id';
import { sendPush } from '$lib/server/push';

const subscriptionSchema = z.object({
	endpoint: z
		.url()
		.max(1000)
		.refine((u) => u.startsWith('https://'), 'Endpoint non valido'),
	keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) })
});

function sameOrigin(request: Request, url: URL) {
	// JSON endpoints are not covered by SvelteKit's form CSRF check: verify Origin explicitly.
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Origine non consentita');
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	sameOrigin(request, url);
	const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Sottoscrizione non valida');
	const { endpoint, keys } = parsed.data;
	const userId = locals.user!.id;
	db.insert(pushSubscriptions)
		.values({
			id: newId(),
			userId,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
			userAgent: request.headers.get('user-agent')?.slice(0, 300)
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId, p256dh: keys.p256dh, auth: keys.auth }
		})
		.run();
	if (url.searchParams.has('test')) {
		await sendPush([userId], {
			title: '🔔 Notifiche attive',
			body: 'Riceverai qui gli aggiornamenti di Splitto.',
			url: '/app'
		});
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals, url }) => {
	sameOrigin(request, url);
	const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
	if (body?.endpoint) {
		db.delete(pushSubscriptions)
			.where(
				and(
					eq(pushSubscriptions.endpoint, body.endpoint),
					eq(pushSubscriptions.userId, locals.user!.id)
				)
			)
			.run();
	}
	return json({ ok: true });
};
