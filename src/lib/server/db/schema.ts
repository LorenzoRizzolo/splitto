import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { CATEGORIES, type Category } from '../../domain/categories';
import { SPLIT_MODES, type SplitMode } from '../../domain/split';

// Conventions:
// - Splitto works only in euro: all money amounts are integer euro cents.
// - Timestamps are integer milliseconds since epoch; calendar dates are 'YYYY-MM-DD' text.

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () =>
	timestamp('created_at')
		.notNull()
		.default(sql`(unixepoch('subsec') * 1000)`);

export const NOTIFICATION_EVENTS = [
	'expense_added',
	'expense_updated',
	'settlement_received',
	'payment_reminder',
	'group_invite',
	'recurring_generated',
	'budget_alert'
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type NotifyPrefs = Record<NotificationEvent, boolean>;

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	avatarPath: text('avatar_path'),
	avatarColor: text('avatar_color').notNull(),
	notifyPrefs: text('notify_prefs', { mode: 'json' })
		.$type<Partial<NotifyPrefs>>()
		.notNull()
		.default({}),
	reduceMotion: integer('reduce_motion', { mode: 'boolean' }).notNull().default(false),
	onboardedAt: timestamp('onboarded_at'),
	createdAt: createdAt(),
	deletedAt: timestamp('deleted_at')
});

export const sessions = sqliteTable(
	'sessions',
	{
		// SHA-256 of the session token; the raw token only lives in the cookie.
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull(),
	usedAt: timestamp('used_at'),
	createdAt: createdAt()
});

export const GROUP_TYPES = ['home', 'trip', 'couple', 'other'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const groups = sqliteTable('groups', {
	id: text('id').primaryKey(),
	// 'direct' groups are hidden containers for 1-to-1 friend expenses.
	kind: text('kind', { enum: ['group', 'direct'] })
		.notNull()
		.default('group'),
	name: text('name').notNull(),
	emoji: text('emoji').notNull().default('👥'),
	type: text('type', { enum: GROUP_TYPES }).notNull().default('other'),
	budgetCents: integer('budget_cents'),
	budgetAlertSentAt: timestamp('budget_alert_sent_at'),
	archivedAt: timestamp('archived_at'),
	createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: createdAt()
});

export const groupMembers = sqliteTable(
	'group_members',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		// NULL for guests that have not registered (or claimed their profile) yet.
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		guestName: text('guest_name'),
		role: text('role', { enum: ['admin', 'member'] })
			.notNull()
			.default('member'),
		joinedAt: createdAt(),
		leftAt: timestamp('left_at')
	},
	(t) => [
		uniqueIndex('group_members_group_user_uq').on(t.groupId, t.userId),
		index('group_members_user_idx').on(t.userId)
	]
);

export const friendships = sqliteTable(
	'friendships',
	{
		// Always stored with userAId < userBId so each pair appears once.
		userAId: text('user_a_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		userBId: text('user_b_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.userAId, t.userBId] }), index('friendships_b_idx').on(t.userBId)]
);

export const invites = sqliteTable(
	'invites',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		// Optional: the invite is meant for a specific guest profile to claim.
		guestMemberId: text('guest_member_id').references((): AnySQLiteColumn => groupMembers.id, {
			onDelete: 'cascade'
		}),
		expiresAt: timestamp('expires_at').notNull(),
		revokedAt: timestamp('revoked_at'),
		createdAt: createdAt()
	},
	(t) => [index('invites_group_idx').on(t.groupId)]
);

export { SPLIT_MODES, type SplitMode };

export { CATEGORIES, type Category };

export const recurringExpenses = sqliteTable(
	'recurring_expenses',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		frequency: text('frequency', { enum: ['weekly', 'monthly', 'yearly'] }).notNull(),
		// Next occurrence as 'YYYY-MM-DD'.
		nextRunOn: text('next_run_on').notNull(),
		// Snapshot of the expense input (description, amount, payers, split…).
		template: text('template', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		lastRunAt: timestamp('last_run_at')
	},
	(t) => [index('recurring_next_idx').on(t.active, t.nextRunOn)]
);

export const expenses = sqliteTable(
	'expenses',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		description: text('description').notNull(),
		category: text('category', { enum: CATEGORIES }).notNull().default('other'),
		date: text('date').notNull(),
		amountCents: integer('amount_cents').notNull(),
		splitMode: text('split_mode', { enum: SPLIT_MODES }).notNull(),
		// Original split input (percentages, shares, items…) so the expense can be edited again.
		splitInput: text('split_input', { mode: 'json' }).$type<unknown>().notNull(),
		notes: text('notes'),
		receiptPath: text('receipt_path'),
		recurringId: text('recurring_id').references(() => recurringExpenses.id, {
			onDelete: 'set null'
		}),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: createdAt(),
		deletedAt: timestamp('deleted_at'),
		deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [index('expenses_group_date_idx').on(t.groupId, t.date)]
);

export const expensePayers = sqliteTable(
	'expense_payers',
	{
		expenseId: text('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		memberId: text('member_id')
			.notNull()
			.references(() => groupMembers.id, { onDelete: 'restrict' }),
		amountCents: integer('amount_cents').notNull()
	},
	(t) => [primaryKey({ columns: [t.expenseId, t.memberId] })]
);

export const expenseShares = sqliteTable(
	'expense_shares',
	{
		expenseId: text('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		memberId: text('member_id')
			.notNull()
			.references(() => groupMembers.id, { onDelete: 'restrict' }),
		amountCents: integer('amount_cents').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.expenseId, t.memberId] }),
		index('expense_shares_member_idx').on(t.memberId)
	]
);

export const expenseComments = sqliteTable(
	'expense_comments',
	{
		id: text('id').primaryKey(),
		expenseId: text('expense_id')
			.notNull()
			.references(() => expenses.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('expense_comments_expense_idx').on(t.expenseId)]
);

export const SETTLEMENT_METHODS = ['cash', 'bank', 'paypal', 'satispay', 'other'] as const;
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export const settlements = sqliteTable(
	'settlements',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		fromMemberId: text('from_member_id')
			.notNull()
			.references(() => groupMembers.id, { onDelete: 'restrict' }),
		toMemberId: text('to_member_id')
			.notNull()
			.references(() => groupMembers.id, { onDelete: 'restrict' }),
		amountCents: integer('amount_cents').notNull(),
		method: text('method', { enum: SETTLEMENT_METHODS }).notNull().default('cash'),
		date: text('date').notNull(),
		note: text('note'),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		deletedAt: timestamp('deleted_at')
	},
	(t) => [index('settlements_group_idx').on(t.groupId)]
);

export const ACTIVITY_TYPES = [
	'group_created',
	'group_updated',
	'group_archived',
	'member_added',
	'member_joined',
	'member_left',
	'member_removed',
	'guest_claimed',
	'expense_created',
	'expense_updated',
	'expense_deleted',
	'expense_restored',
	'settlement_created',
	'settlement_deleted',
	'comment_added',
	'recurring_generated'
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activities = sqliteTable(
	'activities',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
		type: text('type', { enum: ACTIVITY_TYPES }).notNull(),
		entityId: text('entity_id'),
		data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAt()
	},
	(t) => [index('activities_group_created_idx').on(t.groupId, t.createdAt)]
);

export const paymentReminders = sqliteTable(
	'payment_reminders',
	{
		id: text('id').primaryKey(),
		groupId: text('group_id')
			.notNull()
			.references(() => groups.id, { onDelete: 'cascade' }),
		fromUserId: text('from_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		toMemberId: text('to_member_id')
			.notNull()
			.references(() => groupMembers.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [index('payment_reminders_lookup_idx').on(t.fromUserId, t.toMemberId, t.createdAt)]
);

export const pushSubscriptions = sqliteTable(
	'push_subscriptions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		userAgent: text('user_agent'),
		createdAt: createdAt()
	},
	(t) => [index('push_subscriptions_user_idx').on(t.userId)]
);

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Activity = typeof activities.$inferSelect;
