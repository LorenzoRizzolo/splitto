import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { passwordResetTokens, users } from '../db/schema';
import { newToken } from '../db/id';
import { hashToken } from './session';
import { getMailer } from '../mailer';
import { config } from '../config';

const RESET_TTL_MS = 60 * 60 * 1000;

/** Creates a single-use reset token and "sends" the email. Silent if the email is unknown. */
export async function requestPasswordReset(email: string) {
	const user = db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.where(and(eq(users.email, email), isNull(users.deletedAt)))
		.get();
	if (!user) return;

	// Only the latest token is valid.
	db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)).run();
	const token = newToken();
	db.insert(passwordResetTokens)
		.values({
			id: hashToken(token),
			userId: user.id,
			expiresAt: new Date(Date.now() + RESET_TTL_MS)
		})
		.run();

	const link = `${config.origin}/reset-password/${token}`;
	await getMailer().send({
		to: user.email,
		subject: 'Reimposta la password di Splitto',
		text: `Ciao ${user.name},\n\nper scegliere una nuova password apri questo link (valido per 1 ora):\n${link}\n\nSe non hai chiesto tu il reset, ignora questa email.`
	});
}

/** Returns the user id for a valid, unused, unexpired token. */
export function checkResetToken(token: string): string | null {
	const row = db
		.select({ userId: passwordResetTokens.userId })
		.from(passwordResetTokens)
		.where(
			and(
				eq(passwordResetTokens.id, hashToken(token)),
				isNull(passwordResetTokens.usedAt),
				gt(passwordResetTokens.expiresAt, new Date())
			)
		)
		.get();
	return row?.userId ?? null;
}

export function consumeResetToken(token: string) {
	db.update(passwordResetTokens)
		.set({ usedAt: new Date() })
		.where(eq(passwordResetTokens.id, hashToken(token)))
		.run();
}
