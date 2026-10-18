import { error } from '@sveltejs/kit';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { newId, newToken } from '../db/id';
import { friendships, groupMembers, groups, invites, users, type Group } from '../db/schema';
import { logActivity } from './activity';
import { notify } from './notify';
import type { Actor } from './groups';
import { config } from '../config';

const DAY = 86_400_000;

export function inviteUrl(token: string) {
	return `${config.origin}/invite/${token}`;
}

export function createInvite(
	actor: Actor,
	opts: { guestMemberId?: string | null; days?: number } = {}
) {
	if (opts.guestMemberId) {
		const guest = db
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.id, opts.guestMemberId), eq(groupMembers.groupId, actor.group.id)))
			.get();
		if (!guest || guest.userId) error(400, 'Ospite non valido');
	}
	const token = newToken();
	const days = Math.min(Math.max(opts.days ?? 7, 1), 30);
	db.insert(invites)
		.values({
			id: newId(),
			groupId: actor.group.id,
			token,
			createdBy: actor.userId,
			guestMemberId: opts.guestMemberId ?? null,
			expiresAt: new Date(Date.now() + days * DAY)
		})
		.run();
	return token;
}

export function listActiveInvites(groupId: string) {
	return db
		.select()
		.from(invites)
		.where(
			and(
				eq(invites.groupId, groupId),
				isNull(invites.revokedAt),
				gt(invites.expiresAt, new Date())
			)
		)
		.orderBy(desc(invites.createdAt))
		.all();
}

export function revokeInvite(actor: Actor, inviteId: string) {
	db.update(invites)
		.set({ revokedAt: new Date() })
		.where(and(eq(invites.id, inviteId), eq(invites.groupId, actor.group.id)))
		.run();
}

export type InviteInfo = {
	inviteId: string;
	group: Group;
	inviterName: string | null;
	/** Guest profile reserved by the invite, if any. */
	guest: { id: string; name: string } | null;
	/** Unclaimed guests the new member may say they are. */
	claimableGuests: { id: string; name: string }[];
};

/** Resolves a token to a valid invite (not revoked/expired, group not archived). */
export function getInvite(token: string): InviteInfo | null {
	const row = db
		.select({ invite: invites, group: groups, inviterName: users.name })
		.from(invites)
		.innerJoin(groups, eq(groups.id, invites.groupId))
		.leftJoin(users, eq(users.id, invites.createdBy))
		.where(
			and(eq(invites.token, token), isNull(invites.revokedAt), gt(invites.expiresAt, new Date()))
		)
		.get();
	if (!row || row.group.archivedAt) return null;
	const guests = db
		.select({ id: groupMembers.id, name: groupMembers.guestName })
		.from(groupMembers)
		.where(
			and(
				eq(groupMembers.groupId, row.group.id),
				isNull(groupMembers.userId),
				isNull(groupMembers.leftAt)
			)
		)
		.all()
		.map((g) => ({ id: g.id, name: g.name ?? 'Ospite' }));
	const guest = row.invite.guestMemberId
		? (guests.find((g) => g.id === row.invite.guestMemberId) ?? null)
		: null;
	return {
		inviteId: row.invite.id,
		group: row.group,
		inviterName: row.inviterName,
		guest,
		claimableGuests: guest ? [guest] : guests
	};
}

/**
 * Joins the group through an invite. If `claimGuestId` is given, the user takes over that
 * guest profile and inherits its whole history.
 */
export function acceptInvite(
	token: string,
	userId: string,
	claimGuestId: string | null
): { groupId: string; kind: Group['kind'] } {
	const info = getInvite(token);
	if (!info) error(410, "L'invito non è più valido");
	const { group } = info;
	if (info.guest && claimGuestId !== info.guest.id) claimGuestId = info.guest.id;
	if (claimGuestId && !info.claimableGuests.some((g) => g.id === claimGuestId))
		error(400, 'Profilo ospite non valido');

	const user = db.select({ name: users.name }).from(users).where(eq(users.id, userId)).get();
	if (!user) error(401);

	db.transaction((tx) => {
		const existing = tx
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
			.get();
		if (existing && !existing.leftAt) {
			if (claimGuestId)
				error(409, 'Fai già parte di questo gruppo: non puoi rivendicare un profilo ospite');
			return;
		}
		if (group.kind === 'direct') {
			const others = tx.select().from(groupMembers).where(eq(groupMembers.groupId, group.id)).all();
			const owner = others.find((m) => m.userId);
			if (!claimGuestId || !owner?.userId) error(400, 'Invito non valido');
			if (owner.userId === userId) error(400, 'Non puoi accettare il tuo stesso invito');
			const [a, b] = owner.userId < userId ? [owner.userId, userId] : [userId, owner.userId];
			const dup = tx
				.select()
				.from(friendships)
				.where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
				.get();
			if (dup) error(409, 'Siete già amici su Splitto: usa le vostre spese 1-a-1 esistenti');
			tx.insert(friendships).values({ userAId: a, userBId: b, groupId: group.id }).run();
		}
		if (claimGuestId) {
			// A former member already has their own history in the group: they simply re-join.
			if (existing)
				error(409, 'Sei già stato membro di questo gruppo: unisciti senza rivendicare un ospite');
			tx.update(groupMembers)
				.set({ userId, guestName: null })
				.where(eq(groupMembers.id, claimGuestId))
				.run();
			logActivity(tx, {
				groupId: group.id,
				actorUserId: userId,
				type: 'guest_claimed',
				entityId: claimGuestId,
				data: {
					name: user.name,
					guestName: info.claimableGuests.find((g) => g.id === claimGuestId)?.name
				}
			});
		} else if (existing) {
			tx.update(groupMembers).set({ leftAt: null }).where(eq(groupMembers.id, existing.id)).run();
			logActivity(tx, {
				groupId: group.id,
				actorUserId: userId,
				type: 'member_joined',
				entityId: existing.id,
				data: { name: user.name }
			});
		} else {
			const id = newId();
			tx.insert(groupMembers).values({ id, groupId: group.id, userId }).run();
			logActivity(tx, {
				groupId: group.id,
				actorUserId: userId,
				type: 'member_joined',
				entityId: id,
				data: { name: user.name }
			});
		}
	});

	const admins = db
		.select({ userId: groupMembers.userId })
		.from(groupMembers)
		.where(
			and(
				eq(groupMembers.groupId, group.id),
				eq(groupMembers.role, 'admin'),
				isNull(groupMembers.leftAt)
			)
		)
		.all()
		.map((m) => m.userId)
		.filter((id) => id !== userId);
	notify(admins, 'group_invite', {
		title: `${user.name} si è unito`,
		body:
			group.kind === 'direct'
				? 'Ora potete dividere le spese su Splitto'
				: `al gruppo ${group.name}`,
		url: `/app/groups/${group.id}`
	});
	return { groupId: group.id, kind: group.kind };
}
