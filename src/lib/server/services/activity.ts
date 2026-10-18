import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../db';
import type { Executor } from '../db/client';
import { newId } from '../db/id';
import { activities, groupMembers, groups, users, type ActivityType } from '../db/schema';

export function logActivity(
	ex: Executor,
	a: {
		groupId: string;
		actorUserId: string | null;
		type: ActivityType;
		entityId?: string | null;
		data?: Record<string, unknown>;
	}
) {
	ex.insert(activities)
		.values({
			id: newId(),
			groupId: a.groupId,
			actorUserId: a.actorUserId,
			type: a.type,
			entityId: a.entityId ?? null,
			data: a.data ?? {}
		})
		.run();
}

export type ActivityView = {
	id: string;
	type: ActivityType;
	groupId: string;
	groupName: string;
	groupKind: 'group' | 'direct';
	groupEmoji: string;
	actorName: string;
	actorIsMe: boolean;
	entityId: string | null;
	data: Record<string, unknown>;
	createdAt: Date;
};

/** Activity of the groups the user currently belongs to, newest first. */
export function listActivity(
	userId: string,
	opts: { groupId?: string; limit?: number; before?: Date } = {}
): ActivityView[] {
	const myGroups = db
		.select({ groupId: groupMembers.groupId })
		.from(groupMembers)
		.where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
	const rows = db
		.select({
			a: activities,
			groupName: groups.name,
			groupKind: groups.kind,
			groupEmoji: groups.emoji,
			actorName: users.name
		})
		.from(activities)
		.innerJoin(groups, eq(groups.id, activities.groupId))
		.leftJoin(users, eq(users.id, activities.actorUserId))
		.where(
			and(
				inArray(activities.groupId, myGroups),
				opts.groupId ? eq(activities.groupId, opts.groupId) : undefined,
				opts.before ? lt(activities.createdAt, opts.before) : undefined
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(opts.limit ?? 50)
		.all();
	return rows.map((r) => ({
		id: r.a.id,
		type: r.a.type,
		groupId: r.a.groupId,
		groupName: r.groupName,
		groupKind: r.groupKind,
		groupEmoji: r.groupEmoji,
		actorName: r.actorName ?? 'Splitto',
		actorIsMe: r.a.actorUserId === userId,
		entityId: r.a.entityId,
		data: r.a.data,
		createdAt: r.a.createdAt
	}));
}
