import { error } from '@sveltejs/kit';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { newId } from '../db/id';
import {
	friendships,
	groupMembers,
	groups,
	users,
	type Group,
	type GroupMember,
	type GroupType
} from '../db/schema';
import { logActivity } from './activity';

export type Actor = { userId: string; group: Group; member: GroupMember };

export type MemberView = {
	id: string;
	userId: string | null;
	name: string;
	avatarUrl: string | null;
	avatarColor: string | null;
	isGuest: boolean;
	role: 'admin' | 'member';
	active: boolean;
	isMe: boolean;
};

export function avatarUrl(userId: string, avatarPath: string | null): string | null {
	return avatarPath ? `/app/avatars/${userId}?v=${encodeURIComponent(avatarPath)}` : null;
}

/** The active membership of a user in a group, or null. Never use group data without it. */
export function getMembership(userId: string, groupId: string): Actor | null {
	const row = db
		.select({ group: groups, member: groupMembers })
		.from(groupMembers)
		.innerJoin(groups, eq(groups.id, groupMembers.groupId))
		.where(
			and(
				eq(groupMembers.groupId, groupId),
				eq(groupMembers.userId, userId),
				isNull(groupMembers.leftAt)
			)
		)
		.get();
	return row ? { userId, group: row.group, member: row.member } : null;
}

/** Throws 404 (not 403, to avoid leaking which ids exist) when the user is not a member. */
export function requireMembership(userId: string, groupId: string): Actor {
	const actor = getMembership(userId, groupId);
	if (!actor) error(404, 'Gruppo non trovato');
	return actor;
}

export function requireAdmin(actor: Actor) {
	if (actor.member.role !== 'admin') error(403, 'Solo gli amministratori del gruppo possono farlo');
}

export function requireNotArchived(actor: Actor) {
	if (actor.group.archivedAt) error(409, 'Il gruppo è archiviato: riattivalo per modificarlo');
}

export function listMembers(groupId: string, viewerUserId?: string): MemberView[] {
	const rows = db
		.select({
			member: groupMembers,
			userName: users.name,
			avatarPath: users.avatarPath,
			avatarColor: users.avatarColor
		})
		.from(groupMembers)
		.leftJoin(users, eq(users.id, groupMembers.userId))
		.where(eq(groupMembers.groupId, groupId))
		// rowid keeps insertion order for members added in the same millisecond.
		.orderBy(asc(groupMembers.joinedAt), asc(sql`${groupMembers}.rowid`))
		.all();
	return rows.map(({ member, userName, avatarPath, avatarColor }) => ({
		id: member.id,
		userId: member.userId,
		name: userName ?? member.guestName ?? 'Ex membro',
		avatarUrl: member.userId ? avatarUrl(member.userId, avatarPath) : null,
		avatarColor,
		isGuest: !member.userId,
		role: member.role,
		active: !member.leftAt,
		isMe: !!viewerUserId && member.userId === viewerUserId
	}));
}

export type GroupInput = {
	name: string;
	emoji: string;
	type: GroupType;
	budgetCents: number | null;
};

export function createGroup(
	userId: string,
	input: GroupInput,
	guestNames: string[] = [],
	friends: { userId: string; name: string }[] = []
): string {
	return db.transaction((tx) => {
		const id = newId();
		tx.insert(groups)
			.values({ id, kind: 'group', createdBy: userId, ...input })
			.run();
		tx.insert(groupMembers).values({ id: newId(), groupId: id, userId, role: 'admin' }).run();
		logActivity(tx, {
			groupId: id,
			actorUserId: userId,
			type: 'group_created',
			entityId: id,
			data: { name: input.name }
		});
		for (const name of guestNames) {
			const memberId = newId();
			tx.insert(groupMembers).values({ id: memberId, groupId: id, guestName: name }).run();
			logActivity(tx, {
				groupId: id,
				actorUserId: userId,
				type: 'member_added',
				entityId: memberId,
				data: { name, guest: true }
			});
		}
		for (const friend of friends) {
			if (friend.userId === userId) continue;
			tx.insert(groupMembers).values({ id: newId(), groupId: id, userId: friend.userId }).run();
			logActivity(tx, {
				groupId: id,
				actorUserId: userId,
				type: 'member_added',
				entityId: friend.userId,
				data: { name: friend.name }
			});
		}
		return id;
	});
}

export function updateGroup(actor: Actor, input: GroupInput) {
	db.transaction((tx) => {
		const budgetChanged = input.budgetCents !== actor.group.budgetCents;
		tx.update(groups)
			.set({ ...input, ...(budgetChanged ? { budgetAlertSentAt: null } : {}) })
			.where(eq(groups.id, actor.group.id))
			.run();
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: 'group_updated',
			entityId: actor.group.id,
			data: { name: input.name }
		});
	});
}

export function setArchived(actor: Actor, archived: boolean) {
	db.transaction((tx) => {
		tx.update(groups)
			.set({ archivedAt: archived ? new Date() : null })
			.where(eq(groups.id, actor.group.id))
			.run();
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: archived ? 'group_archived' : 'group_updated',
			entityId: actor.group.id,
			data: { name: actor.group.name, unarchived: !archived }
		});
	});
}

export function addGuest(actor: Actor, name: string): string {
	return db.transaction((tx) => {
		const id = newId();
		tx.insert(groupMembers).values({ id, groupId: actor.group.id, guestName: name }).run();
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: 'member_added',
			entityId: id,
			data: { name, guest: true }
		});
		return id;
	});
}

/** Adds (or re-activates) a registered user as member. Returns null when the email is unknown. */
export function addRegisteredMember(
	actor: Actor,
	email: string
): { userId: string; name: string; already: boolean } | null {
	const user = db
		.select({ id: users.id, name: users.name })
		.from(users)
		.where(and(eq(users.email, email), isNull(users.deletedAt)))
		.get();
	if (!user) return null;
	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(groupMembers)
			.where(and(eq(groupMembers.groupId, actor.group.id), eq(groupMembers.userId, user.id)))
			.get();
		if (existing && !existing.leftAt) return { userId: user.id, name: user.name, already: true };
		if (existing) {
			tx.update(groupMembers).set({ leftAt: null }).where(eq(groupMembers.id, existing.id)).run();
		} else {
			tx.insert(groupMembers)
				.values({ id: newId(), groupId: actor.group.id, userId: user.id })
				.run();
		}
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: 'member_added',
			entityId: user.id,
			data: { name: user.name }
		});
		return { userId: user.id, name: user.name, already: false };
	});
}

export function setMemberRole(actor: Actor, memberId: string, role: 'admin' | 'member') {
	const target = getGroupMember(actor.group.id, memberId);
	if (!target.userId) error(400, 'Un ospite non può essere amministratore');
	if (role === 'member') {
		const admins = db
			.select({ n: sql<number>`count(*)` })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, actor.group.id),
					eq(groupMembers.role, 'admin'),
					isNull(groupMembers.leftAt)
				)
			)
			.get();
		if ((admins?.n ?? 0) <= 1 && target.role === 'admin')
			error(400, 'Il gruppo deve avere almeno un amministratore');
	}
	db.update(groupMembers).set({ role }).where(eq(groupMembers.id, memberId)).run();
}

export function getGroupMember(groupId: string, memberId: string): GroupMember {
	const m = db
		.select()
		.from(groupMembers)
		.where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId)))
		.get();
	if (!m) error(404, 'Membro non trovato');
	return m;
}

/** Marks a member as having left. The caller must have verified the balance is zero. */
export function deactivateMember(actor: Actor, memberId: string, selfLeave: boolean, name: string) {
	db.transaction((tx) => {
		tx.update(groupMembers)
			.set({ leftAt: new Date(), role: 'member' })
			.where(eq(groupMembers.id, memberId))
			.run();
		// Keep at least one admin: promote the oldest remaining registered member if needed.
		const admins = tx
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, actor.group.id),
					eq(groupMembers.role, 'admin'),
					isNull(groupMembers.leftAt)
				)
			)
			.all();
		if (admins.length === 0) {
			const next = tx
				.select({ id: groupMembers.id })
				.from(groupMembers)
				.where(
					and(
						eq(groupMembers.groupId, actor.group.id),
						isNull(groupMembers.leftAt),
						sql`${groupMembers.userId} is not null`
					)
				)
				.orderBy(asc(groupMembers.joinedAt))
				.get();
			if (next)
				tx.update(groupMembers).set({ role: 'admin' }).where(eq(groupMembers.id, next.id)).run();
		}
		logActivity(tx, {
			groupId: actor.group.id,
			actorUserId: actor.userId,
			type: selfLeave ? 'member_left' : 'member_removed',
			entityId: memberId,
			data: { name }
		});
	});
}

// --- Friends (1-to-1 "direct" groups) -------------------------------------------------------

function orderedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

export function findDirectGroup(userId: string, friendUserId: string): string | null {
	const [a, b] = orderedPair(userId, friendUserId);
	return (
		db
			.select({ groupId: friendships.groupId })
			.from(friendships)
			.where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
			.get()?.groupId ?? null
	);
}

/** Returns the direct group between two registered users, creating it if needed. */
export function ensureDirectGroup(userId: string, friendUserId: string): string {
	if (userId === friendUserId) error(400, 'Non puoi aggiungere te stesso come amico');
	const existing = findDirectGroup(userId, friendUserId);
	if (existing) return existing;
	return db.transaction((tx) => {
		const id = newId();
		tx.insert(groups)
			.values({ id, kind: 'direct', name: 'Spese tra amici', emoji: '🤝', createdBy: userId })
			.run();
		tx.insert(groupMembers).values({ id: newId(), groupId: id, userId }).run();
		tx.insert(groupMembers).values({ id: newId(), groupId: id, userId: friendUserId }).run();
		const [a, b] = orderedPair(userId, friendUserId);
		tx.insert(friendships).values({ userAId: a, userBId: b, groupId: id }).run();
		return id;
	});
}

/** Creates a direct group with a not-yet-registered friend (a guest that can claim it later). */
export function createGuestFriend(
	userId: string,
	name: string
): { groupId: string; guestMemberId: string } {
	return db.transaction((tx) => {
		const groupId = newId();
		const guestMemberId = newId();
		tx.insert(groups)
			.values({
				id: groupId,
				kind: 'direct',
				name: 'Spese tra amici',
				emoji: '🤝',
				createdBy: userId
			})
			.run();
		tx.insert(groupMembers).values({ id: newId(), groupId, userId }).run();
		tx.insert(groupMembers).values({ id: guestMemberId, groupId, guestName: name }).run();
		return { groupId, guestMemberId };
	});
}

/** The other member of a direct group, from the viewer's perspective. */
export function directCounterpart(groupId: string, viewerUserId: string): MemberView | null {
	return listMembers(groupId, viewerUserId).find((m) => !m.isMe) ?? null;
}

/** Display title for any group: direct groups are titled after the other person. */
export function groupTitle(
	group: Pick<Group, 'id' | 'kind' | 'name'>,
	viewerUserId: string
): string {
	if (group.kind !== 'direct') return group.name;
	return directCounterpart(group.id, viewerUserId)?.name ?? group.name;
}
