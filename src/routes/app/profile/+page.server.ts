import { fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	groupMembers,
	pushSubscriptions,
	sessions,
	users,
	NOTIFICATION_EVENTS,
	type NotifyPrefs
} from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { deleteSessionCookie, invalidateUserSessions } from '$lib/server/auth/session';
import { userIsSettled } from '$lib/server/services/balances';
import { deleteUpload, fileField, saveUpload, UploadError } from '$lib/server/uploads';
import { invalid, parseForm, zName, zPassword } from '$lib/server/forms';
import { config } from '$lib/server/config';

/** Accounts created with Google have no password until they set one. */
function passwordHashOf(userId: string): string | undefined {
	return db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).get()
		?.hash;
}

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user!;
	return {
		hasPassword: !!passwordHashOf(user.id),
		prefs: Object.fromEntries(
			NOTIFICATION_EVENTS.map((e) => [e, user.notifyPrefs[e] !== false])
		) as NotifyPrefs,
		reduceMotion: user.reduceMotion,
		hasAvatar: !!user.avatarPath,
		vapidPublicKey: config.vapid.publicKey,
		settled: userIsSettled(user.id)
	};
};

export const actions: Actions = {
	profile: async ({ locals, request }) => {
		const form = parseForm(z.object({ name: zName }), await request.formData());
		if (!form.ok) return invalid(form.errors, form.values, 'profile');
		db.update(users).set({ name: form.data.name }).where(eq(users.id, locals.user!.id)).run();
		return { saved: 'profile' };
	},
	avatar: async ({ locals, request }) => {
		const data = await request.formData();
		const user = locals.user!;
		if (data.get('remove') === 'true') {
			await deleteUpload(user.avatarPath);
			db.update(users).set({ avatarPath: null }).where(eq(users.id, user.id)).run();
			return { saved: 'avatar' };
		}
		const file = fileField(data, 'avatar');
		if (!file) return invalid({ avatar: "Scegli un'immagine" }, {}, 'avatar');
		try {
			const path = await saveUpload(file, 'avatars');
			await deleteUpload(user.avatarPath);
			db.update(users).set({ avatarPath: path }).where(eq(users.id, user.id)).run();
		} catch (err) {
			if (err instanceof UploadError) return invalid({ avatar: err.message }, {}, 'avatar');
			throw err;
		}
		return { saved: 'avatar' };
	},
	preferences: async ({ locals, request }) => {
		const data = await request.formData();
		const prefs = Object.fromEntries(
			NOTIFICATION_EVENTS.map((e) => [e, data.get(e) === 'on'])
		) as NotifyPrefs;
		db.update(users)
			.set({ notifyPrefs: prefs, reduceMotion: data.get('reduceMotion') === 'on' })
			.where(eq(users.id, locals.user!.id))
			.run();
		return { saved: 'preferences', reduceMotion: data.get('reduceMotion') === 'on' };
	},
	password: async ({ locals, request }) => {
		const form = parseForm(
			z
				.object({
					current: z.string(),
					password: zPassword,
					confirm: z.string()
				})
				.refine((v) => v.password === v.confirm, {
					message: 'Le password non coincidono',
					path: ['confirm']
				}),
			await request.formData()
		);
		if (!form.ok) return invalid(form.errors, {}, 'password');
		const hash = passwordHashOf(locals.user!.id);
		if (hash === undefined) return invalid({ form: 'Account non trovato' }, {}, 'password');
		if (hash) {
			if (!form.data.current) {
				return invalid({ current: 'Inserisci la password attuale' }, {}, 'password');
			}
			if (!(await verifyPassword(hash, form.data.current))) {
				return invalid({ current: 'Password attuale non corretta' }, {}, 'password');
			}
		}
		db.update(users)
			.set({ passwordHash: await hashPassword(form.data.password) })
			.where(eq(users.id, locals.user!.id))
			.run();
		// Other devices are logged out; this session stays valid.
		invalidateUserSessions(locals.user!.id, locals.session!.id);
		return { saved: 'password' };
	},
	delete: async ({ locals, request, cookies }) => {
		const user = locals.user!;
		const data = await request.formData();
		const hash = passwordHashOf(user.id);
		if (hash) {
			if (!(await verifyPassword(hash, String(data.get('password') ?? '')))) {
				return invalid({ deletePassword: 'Password non corretta' }, {}, 'delete');
			}
		} else if (
			hash === undefined ||
			String(data.get('email') ?? '')
				.trim()
				.toLowerCase() !== user.email
		) {
			return invalid({ deletePassword: 'L’email non corrisponde' }, {}, 'delete');
		}
		if (!userIsSettled(user.id)) {
			return fail(400, {
				action: 'delete',
				errors: {
					form: 'Hai ancora dei saldi aperti: salda tutti i conti prima di eliminare l’account.'
				},
				values: {}
			});
		}
		db.transaction((tx) => {
			// Keep group history readable: memberships become "former guests" with the user's name.
			tx.update(groupMembers)
				.set({ guestName: user.name, userId: null, leftAt: new Date(), role: 'member' })
				.where(and(eq(groupMembers.userId, user.id), isNull(groupMembers.leftAt)))
				.run();
			tx.update(groupMembers)
				.set({ guestName: user.name, userId: null })
				.where(eq(groupMembers.userId, user.id))
				.run();
			tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id)).run();
			tx.delete(sessions).where(eq(sessions.userId, user.id)).run();
			tx.delete(users).where(eq(users.id, user.id)).run();
		});
		await deleteUpload(user.avatarPath);
		deleteSessionCookie(cookies);
		redirect(303, '/?logout=1&deleted=1');
	}
};
