import { redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { friendBalances, userGroupSummaries } from '$lib/server/services/balances';
import {
	createGuestFriend,
	ensureDirectGroup,
	listMembers,
	requireMembership
} from '$lib/server/services/groups';
import { createInvite } from '$lib/server/services/invites';
import { invalid, parseForm, zName } from '$lib/server/forms';

export const load: PageServerLoad = ({ locals }) => {
	const userId = locals.user!.id;
	const friends = friendBalances(userId, userGroupSummaries(userId), (gid) =>
		listMembers(gid, userId)
	);
	return {
		friends: friends.map((f) => ({
			key: f.userId ?? f.directGroupId ?? f.name,
			userId: f.userId,
			name: f.name,
			avatarUrl: f.avatarUrl,
			avatarColor: f.avatarColor,
			net: f.net,
			directGroupId: f.directGroupId,
			groups: f.byGroup.filter((g) => g.kind === 'group').map((g) => g.groupName)
		}))
	};
};

export const actions: Actions = {
	add: async ({ locals, request }) => {
		const form = parseForm(
			z.object({ who: z.string().trim().min(1, 'Scrivi un nome o un’email').max(254) }),
			await request.formData()
		);
		if (!form.ok) return invalid(form.errors, form.values);
		const userId = locals.user!.id;
		const who = form.data.who;
		if (who.includes('@')) {
			const email = z.email().safeParse(who.toLowerCase());
			if (!email.success) return invalid({ who: 'Email non valida' }, form.values);
			const friend = db
				.select({ id: users.id })
				.from(users)
				.where(and(eq(users.email, email.data), isNull(users.deletedAt)))
				.get();
			if (!friend) {
				return invalid(
					{ who: 'Nessun utente con questa email. Scrivi solo il nome per invitarlo con un link.' },
					form.values
				);
			}
			if (friend.id === userId) return invalid({ who: 'Questo sei tu 🙂' }, form.values);
			redirect(303, `/app/groups/${ensureDirectGroup(userId, friend.id)}`);
		}
		const name = zName.safeParse(who);
		if (!name.success)
			return invalid({ who: name.error.issues[0]?.message ?? 'Nome non valido' }, form.values);
		const { groupId, guestMemberId } = createGuestFriend(userId, name.data);
		createInvite(requireMembership(userId, groupId), { guestMemberId, days: 30 });
		redirect(303, `/app/groups/${groupId}/settings`);
	}
};
