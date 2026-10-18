// Seeds realistic demo data. Usage: npm run db:seed [-- --reset]
import { count } from 'drizzle-orm';
import {
	openDatabase,
	runMigrations,
	DEFAULT_DATABASE_PATH,
	type DB
} from '../src/lib/server/db/client';
import * as s from '../src/lib/server/db/schema';
import { newId, newToken } from '../src/lib/server/db/id';
import { hashPassword } from '../src/lib/server/auth/password';
import { pickAvatarColor } from '../src/lib/domain/avatar';
import { materializeExpense } from '../src/lib/domain/expense';
import type { SplitInput } from '../src/lib/domain/split';
import type { Category } from '../src/lib/domain/categories';

export const DEMO_PASSWORD = 'splitto-demo';

const path = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
const reset = process.argv.includes('--reset');
const db = openDatabase(path);
runMigrations(db);

const [{ n }] = db.select({ n: count() }).from(s.users).all() as [{ n: number }];
if (n > 0 && !reset) {
	console.error(
		`✖ Il database ${path} contiene già ${n} utenti. Usa "npm run db:seed -- --reset" per svuotarlo e ripopolarlo.`
	);
	process.exit(1);
}

function daysAgo(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString().slice(0, 10);
}

function wipe(db: DB) {
	// Children first, so foreign keys are satisfied.
	for (const table of [
		s.pushSubscriptions,
		s.paymentReminders,
		s.activities,
		s.expenseComments,
		s.expenseShares,
		s.expensePayers,
		s.expenses,
		s.recurringExpenses,
		s.settlements,
		s.invites,
		s.friendships,
		s.groupMembers,
		s.groups,
		s.passwordResetTokens,
		s.sessions,
		s.users
	]) {
		db.delete(table).run();
	}
}

const passwordHash = await hashPassword(DEMO_PASSWORD);

type Member = { id: string; userId: string | null };

db.transaction((tx) => {
	if (reset) wipe(tx as unknown as DB);

	const mkUser = (name: string, email: string) => {
		const id = newId();
		tx.insert(s.users)
			.values({
				id,
				name,
				email,
				passwordHash,
				avatarColor: pickAvatarColor(email),
				onboardedAt: new Date()
			})
			.run();
		return id;
	};
	const marco = mkUser('Marco Rossi', 'marco@splitto.test');
	const giulia = mkUser('Giulia Bianchi', 'giulia@splitto.test');
	const luca = mkUser('Luca Verdi', 'luca@splitto.test');
	const sara = mkUser('Sara Neri', 'sara@splitto.test');

	const mkGroup = (values: Omit<typeof s.groups.$inferInsert, 'id'>) => {
		const id = newId();
		tx.insert(s.groups)
			.values({ id, ...values })
			.run();
		return id;
	};
	const addMember = (
		groupId: string,
		userId: string | null,
		role: 'admin' | 'member' = 'member',
		guestName?: string
	): Member => {
		const id = newId();
		tx.insert(s.groupMembers).values({ id, groupId, userId, role, guestName }).run();
		return { id, userId };
	};
	const activity = (
		groupId: string,
		actor: string | null,
		type: s.ActivityType,
		entityId?: string,
		data: Record<string, unknown> = {}
	) =>
		tx
			.insert(s.activities)
			.values({ id: newId(), groupId, actorUserId: actor, type, entityId, data })
			.run();

	const addExpense = (
		groupId: string,
		e: {
			description: string;
			category: Category;
			daysAgo: number;
			amountCents: number;
			payers: { member: Member; cents: number }[];
			split: SplitInput;
			createdBy: string;
			notes?: string;
			recurringId?: string;
		}
	) => {
		const m = materializeExpense({
			amountCents: e.amountCents,
			payers: e.payers.map((p) => ({ memberId: p.member.id, cents: p.cents })),
			split: e.split
		});
		if (!m.ok) throw new Error(`Seed expense "${e.description}" is invalid: ${m.message}`);
		const id = newId();
		tx.insert(s.expenses)
			.values({
				id,
				groupId,
				description: e.description,
				category: e.category,
				date: daysAgo(e.daysAgo),
				amountCents: e.amountCents,
				splitMode: e.split.mode,
				splitInput: e.split,
				notes: e.notes,
				recurringId: e.recurringId,
				createdBy: e.createdBy
			})
			.run();
		for (const p of m.value.payers) {
			tx.insert(s.expensePayers)
				.values({
					expenseId: id,
					memberId: p.memberId,
					amountCents: p.cents
				})
				.run();
		}
		for (const sh of m.value.shares) {
			tx.insert(s.expenseShares)
				.values({
					expenseId: id,
					memberId: sh.memberId,
					amountCents: sh.cents
				})
				.run();
		}
		activity(groupId, e.createdBy, 'expense_created', id, {
			description: e.description,
			amountCents: e.amountCents
		});
		return id;
	};

	const addSettlement = (
		groupId: string,
		from: Member,
		to: Member,
		cents: number,
		method: s.SettlementMethod,
		days: number,
		by: string
	) => {
		const id = newId();
		tx.insert(s.settlements)
			.values({
				id,
				groupId,
				fromMemberId: from.id,
				toMemberId: to.id,
				amountCents: cents,
				method,
				date: daysAgo(days),
				createdBy: by
			})
			.run();
		activity(groupId, by, 'settlement_created', id, { amountCents: cents });
	};

	// --- Casa -------------------------------------------------------------------------------
	const casa = mkGroup({ name: 'Casa Via Roma 12', emoji: '🏠', type: 'home', createdBy: marco });
	const cM = addMember(casa, marco, 'admin');
	const cG = addMember(casa, giulia);
	const cL = addMember(casa, luca);
	activity(casa, marco, 'group_created', casa, { name: 'Casa Via Roma 12' });
	const all = [cM.id, cG.id, cL.id];

	const internetTemplate = {
		description: 'Internet fibra',
		category: 'bills',
		amountCents: 2990,
		payers: [{ memberId: cM.id, cents: 2990 }],
		split: { mode: 'equal', members: all }
	};
	const recurringId = newId();
	tx.insert(s.recurringExpenses)
		.values({
			id: recurringId,
			groupId: casa,
			frequency: 'monthly',
			nextRunOn: daysAgo(-20),
			template: internetTemplate,
			createdBy: marco
		})
		.run();

	addExpense(casa, {
		description: 'Affitto',
		category: 'home',
		daysAgo: 17,
		amountCents: 120000,
		payers: [{ member: cM, cents: 120000 }],
		split: { mode: 'equal', members: all },
		createdBy: marco
	});
	addExpense(casa, {
		description: 'Bolletta luce',
		category: 'bills',
		daysAgo: 12,
		amountCents: 8740,
		payers: [{ member: cG, cents: 8740 }],
		split: { mode: 'equal', members: all },
		createdBy: giulia
	});
	addExpense(casa, {
		description: 'Spesa Esselunga',
		category: 'food',
		daysAgo: 6,
		amountCents: 6435,
		payers: [{ member: cG, cents: 6435 }],
		split: { mode: 'equal', members: all },
		createdBy: giulia
	});
	addExpense(casa, {
		description: 'Internet fibra',
		category: 'bills',
		daysAgo: 10,
		amountCents: 2990,
		payers: [{ member: cM, cents: 2990 }],
		split: { mode: 'equal', members: all },
		createdBy: marco,
		recurringId
	});
	addExpense(casa, {
		description: 'Detersivi e pulizie',
		category: 'home',
		daysAgo: 3,
		amountCents: 2400,
		payers: [{ member: cL, cents: 2400 }],
		// Luca's room has the extra bathroom.
		split: {
			mode: 'shares',
			shares: [
				{ memberId: cM.id, shares: 1 },
				{ memberId: cG.id, shares: 1 },
				{ memberId: cL.id, shares: 2 }
			]
		},
		createdBy: luca
	});
	addSettlement(casa, cL, cM, 30000, 'bank', 9, luca);

	// --- Viaggio ----------------------------------------------------------------------------
	const trip = mkGroup({
		name: 'Weekend a Lisbona',
		emoji: '✈️',
		type: 'trip',
		budgetCents: 150000,
		createdBy: giulia
	});
	const tG = addMember(trip, giulia, 'admin');
	const tM = addMember(trip, marco);
	const tS = addMember(trip, sara);
	const tA = addMember(trip, null, 'member', 'Andrea');
	activity(trip, giulia, 'group_created', trip, { name: 'Weekend a Lisbona' });
	activity(trip, giulia, 'member_added', tA.id, { name: 'Andrea', guest: true });
	const four = [tG.id, tM.id, tS.id, tA.id];

	addExpense(trip, {
		description: 'Voli Ryanair',
		category: 'travel',
		daysAgo: 30,
		amountCents: 50000,
		payers: [
			{ member: tM, cents: 30000 },
			{ member: tG, cents: 20000 }
		],
		split: { mode: 'equal', members: four },
		createdBy: giulia
	});
	addExpense(trip, {
		description: 'Airbnb Alfama',
		category: 'travel',
		daysAgo: 28,
		amountCents: 48000,
		payers: [{ member: tG, cents: 48000 }],
		split: {
			mode: 'shares',
			shares: [
				{ memberId: tG.id, shares: 1 },
				{ memberId: tM.id, shares: 1 },
				{ memberId: tS.id, shares: 1 },
				{ memberId: tA.id, shares: 1 }
			]
		},
		createdBy: giulia
	});
	addExpense(trip, {
		description: 'Cena al Time Out Market',
		category: 'food',
		daysAgo: 26,
		amountCents: 9250,
		payers: [{ member: tS, cents: 9250 }],
		split: {
			mode: 'itemized',
			items: [
				{ name: 'Bacalhau', cents: 2200, memberIds: [tG.id] },
				{ name: 'Polvo', cents: 2400, memberIds: [tM.id] },
				{ name: 'Francesinha', cents: 1600, memberIds: [tS.id, tA.id] },
				{ name: 'Vinho verde', cents: 2200, memberIds: four }
			],
			taxCents: 0,
			tipCents: 850
		},
		createdBy: sara
	});
	addExpense(trip, {
		description: 'Taxi aeroporto',
		category: 'transport',
		daysAgo: 30,
		amountCents: 3200,
		payers: [{ member: tA, cents: 3200 }],
		split: {
			mode: 'exact',
			amounts: [
				{ memberId: tG.id, cents: 800 },
				{ memberId: tM.id, cents: 800 },
				{ memberId: tS.id, cents: 1600 }
			]
		},
		createdBy: giulia,
		notes: 'Sara ha fatto anche il ritorno'
	});
	addExpense(trip, {
		description: 'Escursione a Sintra',
		category: 'fun',
		daysAgo: 27,
		amountCents: 12000,
		payers: [{ member: tM, cents: 12000 }],
		split: {
			mode: 'percent',
			percents: [
				{ memberId: tG.id, basisPoints: 2500 },
				{ memberId: tM.id, basisPoints: 2500 },
				{ memberId: tS.id, basisPoints: 2500 },
				{ memberId: tA.id, basisPoints: 2500 }
			]
		},
		createdBy: marco,
		notes: 'Prenotata online, biglietti a nome di Marco'
	});
	addExpense(trip, {
		description: 'Pastéis de nata',
		category: 'food',
		daysAgo: 27,
		amountCents: 1800,
		payers: [{ member: tG, cents: 1800 }],
		split: { mode: 'adjust', members: four, adjustments: [{ memberId: tM.id, cents: 300 }] },
		createdBy: giulia
	});

	tx.insert(s.invites)
		.values({
			id: newId(),
			groupId: trip,
			token: newToken(),
			createdBy: giulia,
			guestMemberId: tA.id,
			expiresAt: new Date(Date.now() + 7 * 86400_000)
		})
		.run();

	// --- Amicizia 1-a-1 (gruppo "direct") ----------------------------------------------------
	const direct = mkGroup({
		kind: 'direct',
		name: 'Marco & Sara',
		emoji: '🤝',
		type: 'other',
		createdBy: marco
	});
	const dM = addMember(direct, marco);
	const dS = addMember(direct, sara);
	const [a, b] = marco < sara ? [marco, sara] : [sara, marco];
	tx.insert(s.friendships).values({ userAId: a, userBId: b, groupId: direct }).run();
	addExpense(direct, {
		description: 'Biglietti concerto',
		category: 'fun',
		daysAgo: 4,
		amountCents: 9000,
		payers: [{ member: dS, cents: 9000 }],
		split: { mode: 'equal', members: [dM.id, dS.id] },
		createdBy: sara
	});

	// --- Gruppo archiviato ------------------------------------------------------------------
	const old = mkGroup({
		name: 'Campeggio 2025',
		emoji: '⛺',
		type: 'trip',
		createdBy: luca,
		archivedAt: new Date(Date.now() - 60 * 86400_000)
	});
	const oL = addMember(old, luca, 'admin');
	const oM = addMember(old, marco);
	addExpense(old, {
		description: 'Piazzola campeggio',
		category: 'travel',
		daysAgo: 400,
		amountCents: 8000,
		payers: [{ member: oL, cents: 8000 }],
		split: { mode: 'equal', members: [oL.id, oM.id] },
		createdBy: luca
	});
	addSettlement(old, oM, oL, 4000, 'satispay', 390, marco);
	activity(old, luca, 'group_archived', old);
});

db.$client.close();
console.log(`✔ Seed completato su ${path}`);
console.log(`  Utenti demo (password: ${DEMO_PASSWORD}):`);
for (const email of ['marco', 'giulia', 'luca', 'sara']) console.log(`   • ${email}@splitto.test`);
